import os
import re
from concurrent.futures import ThreadPoolExecutor
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from identity_core.models import (
    UserAPIKey,
    ContextProfile,
    StaticContextAttribute,  # ContextProfile attributes use this model.
    ClientAccessPolicy,
    AccessHistory
)

class SovereignIdentityGatewayTests(APITestCase):

    def setUp(self):
        # 1. Create the test user.
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="password123"
        )

        # 2. Create an API key, including the required allowed_context field.
        self.api_key_str = "sk_live_test123456789"
        self.client_name = "LinkedIn"
        self.key_obj = UserAPIKey.objects.create(
            user=self.user,
            key_name=self.client_name,
            api_key=self.api_key_str,
            allowed_context="professional",  # Required by the model.
            is_active=True
        )

        # 3. Create an EAV context profile and its attributes.
        self.profile = ContextProfile.objects.create(
            user=self.user,
            context_type="professional",
            display_name="Teo Tian Yu"
        )

        # 4. Create static EAV attributes linked to the context profile.
        self.pub_attr = StaticContextAttribute.objects.create(
            context_profile=self.profile,  # Link through the context_profile foreign key.
            attribute_key="title",
            attribute_value="Software Engineer",
            is_private=False
        )

        self.priv_attr = StaticContextAttribute.objects.create(
            context_profile=self.profile,  # Link through the context_profile foreign key.
            attribute_key="salary",
            attribute_value="$100,000",
            is_private=True
        )

        # 5. Configure the client access policy.
        self.policy = ClientAccessPolicy.objects.create(
            user=self.user,
            client_name=self.client_name,
            allowed_context="professional",
            is_allowed=True
        )

        # Resolve endpoint URLs.
        self.profile_url = reverse('api_profile')
        self.upload_url = reverse('api_upload')

    # =========================================================
    # 1. API key and X-Client-Source validation tests.
    # =========================================================
    def test_valid_api_key_and_matching_client_source_success(self):
        """A valid key and matching client source are allowed."""
        headers = {
            'HTTP_X_API_KEY': self.api_key_str,
            'HTTP_X_CLIENT_SOURCE': self.client_name,
            'HTTP_X_CONTEXT': 'professional'
        }
        response = self.client.get(self.profile_url, **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['profile_data']['display_name'], "Teo Tian Yu")

    def test_mismatched_client_source_returns_401(self):
        """A mismatched client source is rejected."""
        headers = {
            'HTTP_X_API_KEY': self.api_key_str,
            'HTTP_X_CLIENT_SOURCE': 'FakeClient',
            'HTTP_X_CONTEXT': 'professional'
        }
        response = self.client.get(self.profile_url, **headers)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_api_key_returns_401(self):
        """An invalid API key returns 401 Unauthorized."""
        headers = {
            'HTTP_X_API_KEY': 'invalid_key_999999',
            'HTTP_X_CLIENT_SOURCE': self.client_name
        }
        response = self.client.get(self.profile_url, **headers)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================
    # 2. Server-side private attribute concealment tests.
    # =========================================================
    def test_private_attribute_concealment(self):
        """Private attributes are returned as a concealed string to third parties."""
        headers = {
            'HTTP_X_API_KEY': self.api_key_str,
            'HTTP_X_CLIENT_SOURCE': self.client_name,
            'HTTP_X_CONTEXT': 'professional'
        }
        response = self.client.get(self.profile_url, **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        attributes = response.data['profile_data']['dynamic_attributes']
        attr_dict = {a['attribute_key']: a['attribute_value'] for a in attributes}

        self.assertEqual(attr_dict.get('title'), "Software Engineer")
        self.assertEqual(attr_dict.get('salary'), "🔑 [CONCEALED: Private Attribute]")

    # =========================================================
    # 3. Global ban and policy enforcement tests (ABAC).
    # =========================================================
    def test_disabled_api_key_returns_403_and_logs(self):
        """A disabled key returns 403 and creates a BLOCKED audit record."""
        self.key_obj.is_active = False
        self.key_obj.save()

        headers = {
            'HTTP_X_API_KEY': self.api_key_str,
            'HTTP_X_CLIENT_SOURCE': self.client_name,
            'HTTP_X_CONTEXT': 'professional'
        }
        response = self.client.get(self.profile_url, **headers)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(AccessHistory.objects.filter(client_name=self.client_name, access_status="BLOCKED").exists())
    # =========================================================
    # 🌟 500 Automated API Access & Leakage Verification Test
    # =========================================================
    def test_500_requests_data_leakage_and_minimization(self):
        """
        Executes 500 automated API queries directed at /api/profile/
        and uses Regex pattern scanning to verify 0.00% plaintext leakage rate
        for private fields (e.g. '$100,000').
        """
        headers = {
            'HTTP_X_API_KEY': self.api_key_str,
            'HTTP_X_CLIENT_SOURCE': self.client_name,
            'HTTP_X_CONTEXT': 'professional'
        }

        # Validation regex: scan whether the plaintext values "$100,000" or "100000" are leaked.
        sensitive_pattern = re.compile(r'\$100,000|\b100000\b')

        leak_count = 0
        total_requests = 500

        # Execute 500 API requests sequentially in the in-memory test database to avoid SQLite multithreading deadlock.
        for _ in range(total_requests):
            resp = self.client.get(self.profile_url, **headers)
            self.assertEqual(resp.status_code, status.HTTP_200_OK)

            resp_content = str(resp.content)

            # Use regex to detect plaintext sensitive values.
            if sensitive_pattern.search(resp_content):
                leak_count += 1

            # Verify that the private field has been replaced with the [CONCEALED] placeholder.
            self.assertIn("[CONCEALED", resp_content)

        # Calculate the leakage rate.
        leakage_rate = (leak_count / total_requests) * 100.0

        # Assertion: the sensitive plaintext leakage rate must be 0.00%.
        self.assertEqual(leak_count, 0)
        self.assertEqual(leakage_rate, 0.00)

    def test_blocked_context_policy_returns_403(self):
        """A denied context policy returns 403."""
        self.policy.is_allowed = False
        self.policy.save()

        headers = {
            'HTTP_X_API_KEY': self.api_key_str,
            'HTTP_X_CLIENT_SOURCE': self.client_name,
            'HTTP_X_CONTEXT': 'professional'
        }
        response = self.client.get(self.profile_url, **headers)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================
    # 4. Secure file upload view tests.
    # =========================================================
    def test_authenticated_user_file_upload_success(self):
        """An authenticated user can upload a PDF and receive a media URL."""
        self.client.force_authenticate(user=self.user)
        dummy_file = SimpleUploadedFile("resume.pdf", b"pdf_content_dummy", content_type="application/pdf")

        response = self.client.post(self.upload_url, {'file': dummy_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('file_url', response.data)
        self.assertTrue(response.data['file_url'].startswith('/media/uploads/'))

    def test_unauthenticated_file_upload_fails(self):
        """An unauthenticated user cannot upload files."""
        dummy_file = SimpleUploadedFile("resume.pdf", b"pdf_content_dummy", content_type="application/pdf")
        response = self.client.post(self.upload_url, {'file': dummy_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)