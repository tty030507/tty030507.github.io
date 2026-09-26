import secrets
import os
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken 
from django.conf import settings 
from django.core.files.storage import FileSystemStorage 
import requests
from identity_core.models import (
    ContextProfile, 
    StaticContextAttribute, 
    PrivacyPolicy, 
    UserDefinedContext, 
    DynamicContextAttribute, 
    ClientAccessPolicy,
    UserAPIKey,
    AccessHistory
)
from identity_core.serializers import UserRegisterSerializer, ContextProfileSerializer, UserAPIKeySerializer

class RegisterView(APIView):
    """1. Register a user and initialize default contexts."""
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email', '')
        password = request.data.get('password')

        if not username or not password:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email, password=password)
        refresh = RefreshToken.for_user(user)

        # Initialize default contexts and privacy policies.
        ContextProfile.objects.get_or_create(user=user, context_type="professional", defaults={"display_name": user.username})
        ContextProfile.objects.get_or_create(user=user, context_type="personal", defaults={"display_name": user.username})
        PrivacyPolicy.objects.get_or_create(user=user, context_type="professional", defaults={"is_context_enabled": True})
        PrivacyPolicy.objects.get_or_create(user=user, context_type="personal", defaults={"is_context_enabled": True})

        return Response({
            "message": "User registered successfully",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user_id": user.id,
            "username": user.username
        }, status=status.HTTP_201_CREATED)


class PasswordResetView(APIView):
    """2. Reset a user's password."""
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username')
        new_password = request.data.get('new_password')

        if not username or not new_password:
            return Response({"error": "Username and new password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(username=username).first()
        if not user:
            return Response({"error": "User does not exist."}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.save()
        return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)


class LoginView(APIView):
    """3. Authenticate a user and issue JWTs."""
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user_id": user.id,
                "username": user.username
            })
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class UserProfileView(APIView):
    """
    Core gateway combining API key validation, access control, and RFC 9110 content negotiation.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = None
        is_third_party = False
        client_name = "System_Owner"
        key_obj = None

        api_key_header = request.headers.get('X-API-KEY') or request.headers.get('X-Api-Key')
        provided_client = request.headers.get('X-Client-Source', '').strip()

        # 1. Validate the API key and client identity together.
        if api_key_header:
            is_third_party = True
            clean_key = api_key_header.strip()
            key_obj = UserAPIKey.objects.filter(api_key=clean_key).first()

            if not key_obj:
                return Response(
                    {"error": "Unauthorized. Invalid API Key."}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Ensure X-Client-Source matches the key's registered client name.
            if provided_client != key_obj.key_name:
                return Response(
                    {
                        "error": (
                            f"Unauthorized. Mismatch client identity"
                        )
                    }, 
                    status=status.HTTP_401_UNAUTHORIZED
                )

            user = key_obj.user
            client_name = key_obj.key_name

        elif request.user and request.user.is_authenticated:
            user = request.user
            is_third_party = False
            client_name = provided_client or "Owner_Dashboard"

        if not user:
            return Response(
                {"error": "Unauthorized. Please login or provide a valid API Key."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        requested_context = request.headers.get('X-Context') or request.query_params.get('context') or "professional"
        
        if provided_client and provided_client != "Owner_Dashboard" and not api_key_header:
            is_third_party = True
            client_name = provided_client

        # 2. Check the global ban status.
        if is_third_party and key_obj and not key_obj.is_active:
            AccessHistory.objects.create(
                user=user, 
                client_name=client_name,
                requested_context=requested_context, 
                access_status="BLOCKED"
            )
            return Response(
                {"error": f"Access Denied. API Key '{client_name}' is disabled."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Check the context-specific client access policy.
        if is_third_party:
            policy_check = ClientAccessPolicy.objects.filter(
                user=user, client_name=client_name, allowed_context=requested_context
            ).first()

            if not policy_check or not policy_check.is_allowed:
                AccessHistory.objects.create(
                    user=user, 
                    client_name=client_name, 
                    requested_context=requested_context, 
                    access_status="BLOCKED"
                )
                return Response(
                    {"error": f"Access Denied. Realm '{requested_context}' is blocked for client '{client_name}'."},
                    status=status.HTTP_403_FORBIDDEN
                )

            AccessHistory.objects.create(
                user=user, 
                client_name=client_name, 
                requested_context=requested_context, 
                access_status="ALLOWED"
            )

        # 4. Extract the language from RFC 9110 Accept-Language negotiation.
        accept_lang = request.headers.get('Accept-Language', 'en-US')
        raw_lang = accept_lang.split(',')[0].split('-')[0].strip().lower()

        raw_attributes = []
        display_name = user.username

        # Load the requested context data.
        profile = ContextProfile.objects.filter(user=user, context_type=requested_context).first()
        if profile:
            display_name = profile.display_name
            raw_attributes = list(profile.dynamic_attributes.all())
        else:
            custom_ctx = UserDefinedContext.objects.filter(user=user, context_name=requested_context).first()
            if custom_ctx:
                display_name = custom_ctx.display_title
                raw_attributes = list(custom_ctx.attributes.all())

        # Build the attribute list and collect translatable values.
        final_attributes = []
        texts_to_translate = [display_name]
        translatable_indices = []

        for idx, attr in enumerate(raw_attributes):
            is_concealed = is_third_party and attr.is_private
            val = "🔑 [CONCEALED: Private Attribute]" if is_concealed else attr.attribute_value
            
            final_attributes.append({
                "id": attr.id,
                "attribute_key": attr.attribute_key,
                "attribute_value": val,
                "is_private": attr.is_private
            })

            if not is_concealed and val:
                texts_to_translate.append(val)
                translatable_indices.append(idx)

        api_key = getattr(settings, "GOOGLE_TRANSLATE_API_KEY", None)

        if raw_lang != 'en' and len(texts_to_translate) > 0 and api_key:
            try:
                # Adapt the language code for Google Translate, such as zh-CN.
                target_lang = "zh-CN" if raw_lang == "zh" else raw_lang

                # Google supports batch POST requests with a q array.
                res = requests.post(
                    f"https://translation.googleapis.com/language/translate/v2?key={api_key}",
                    json={
                        "q": texts_to_translate,
                        "target": target_lang
                    },
                    timeout=3  # Keep the gateway responsive if translation is unavailable.
                )

                if res.status_code == 200:
                    data = res.json()
                    translations = [item.get("translatedText") for item in data.get("data", {}).get("translations", [])]

                    if len(translations) == len(texts_to_translate):
                        display_name = translations[0]
                        for t_idx, attr_idx in enumerate(translatable_indices):
                            final_attributes[attr_idx]["attribute_value"] = translations[t_idx + 1]
                else:
                    print(f"[Content Negotiation Error] Google Cloud API HTTP {res.status_code}: {res.text}")

            except Exception as e:
                # Fall back silently so translation errors do not break the main request.
                print(f"[Content Negotiation Fallback] Google Cloud API Bypass: {e}")

        return Response({
            "user_id": user.id,
            "username": user.username,
            "requested_context": requested_context,
            "negotiated_language": accept_lang,
            "translation_engine": "LibreTranslate (RFC 9110)",
            "profile_data": {
                "display_name": display_name,
                "dynamic_attributes": final_attributes
            }
        }, status=status.HTTP_200_OK)

class AddCustomAttributeView(APIView):
    """5. Create or update a context attribute."""
    permission_classes = [IsAuthenticated]
    def post(self, request):
        user = request.user
        context_type = request.data.get('context_type')
        key = request.data.get('attribute_key')
        value = request.data.get('attribute_value')
        is_private = request.data.get('is_private', False)

        if not context_type or not key or not value:
            return Response({"error": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        # Check predefined contexts first.
        profile, _ = ContextProfile.objects.get_or_create(user=user, context_type=context_type, defaults={"display_name": user.username})
        if profile:
            StaticContextAttribute.objects.update_or_create(
                context_profile=profile, attribute_key=key,
                defaults={'attribute_value': value, 'is_private': is_private}
            )
            return Response({"status": f"Attribute '{key}' synced successfully."})

        # Check user-defined contexts if no predefined context exists.
        custom_ctx = UserDefinedContext.objects.filter(user=user, context_name=context_type).first()
        if custom_ctx:
            DynamicContextAttribute.objects.update_or_create(
                dynamic_context=custom_ctx, attribute_key=key,
                defaults={'attribute_value': value, 'is_private': is_private}
            )
            return Response({"status": f"Attribute '{key}' synced successfully."})

        return Response({"error": "Target space not found."}, status=status.HTTP_400_BAD_REQUEST)


# ==================== 6. API Key Governance Views ====================

class CreateAPIKeyView(APIView):
    """Create a new API key, disabled by default and not tied to one context."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        key_name = request.data.get('key_name')
        
        if not key_name:
            return Response({"error": "Client key name is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        generated_key = f"sk_live_{secrets.token_hex(16)}"
        # Keep new keys disabled until the owner enables them.
        key_obj = UserAPIKey.objects.create(
            user=user, key_name=key_name, api_key=generated_key, 
            allowed_context="All Contexts (Manage Rules)", is_active=False
        )
        return Response({
            "status": "API Key Created",
            "key_id": key_obj.id,
            "key_name": key_obj.key_name,
            "api_key": key_obj.api_key,
            "is_active": key_obj.is_active
        }, status=status.HTTP_201_CREATED)


class ToggleAPIKeyBanView(APIView):
    """Toggle an API key's enabled state."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        key_id = request.data.get('key_id')
        is_active = request.data.get('is_active')

        key_obj = UserAPIKey.objects.filter(user=user, id=key_id).first()
        if not key_obj:
            return Response({"error": "API Key not found."}, status=status.HTTP_404_NOT_FOUND)

        key_obj.is_active = is_active
        key_obj.save()
        return Response({"status": f"Key '{key_obj.key_name}' is now {'Active' if is_active else 'Disabled'}."})


class ListAPIKeysView(APIView):
    """List all API keys issued by the user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        keys = UserAPIKey.objects.filter(user=request.user)
        serializer = UserAPIKeySerializer(keys, many=True)
        return Response({"api_keys": serializer.data})


class UpdateAPIKeyScopeView(APIView):
    """Set a context-specific access policy for an API key."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        client_name = request.data.get('client_name')
        context_name = request.data.get('context_name')
        is_allowed = request.data.get('is_allowed', True)

        policy, _ = ClientAccessPolicy.objects.update_or_create(
            user=user, client_name=client_name, allowed_context=context_name,
            defaults={'is_allowed': is_allowed}
        )
        return Response({"status": "Policy updated", "client": client_name, "context": context_name, "allowed": is_allowed})


class CreateUserContextView(APIView):
    """Create a new user-defined context."""
    permission_classes = [IsAuthenticated]
    def post(self, request):
        user = request.user
        name = request.data.get('context_name')
        title = request.data.get('display_title')
        if not name or not title:
            return Response({"error": "Missing name or title"}, status=status.HTTP_400_BAD_REQUEST)
        ctx, created = UserDefinedContext.objects.get_or_create(user=user, context_name=name, defaults={'display_title': title})
        
        # Initialize the corresponding profile record.
        ContextProfile.objects.get_or_create(user=user, context_type=name, defaults={"display_name": title})
        return Response({"status": "Success", "created": created}, status=status.HTTP_201_CREATED)


class ListUserContextView(APIView):
    """List all user-defined contexts."""
    permission_classes = [IsAuthenticated]
    def get(self, request):
        contexts = UserDefinedContext.objects.filter(user=request.user)
        data = [{"context_name": c.context_name, "display_title": c.display_title} for c in contexts]
        return Response({"custom_contexts": data})


class GetAccessHistoryLogView(APIView):
    """List the user's access audit history."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = AccessHistory.objects.filter(user=request.user)
        log_data = [{
            "client_name": l.client_name,
            "requested_context": l.requested_context,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "access_status": l.access_status
        } for l in logs]
        return Response({"audit_logs": log_data})

class GetAPIKeyPoliciesView(APIView):
    """Get the selected API key's authorization status by context."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client_name = request.query_params.get('client_name')
        if not client_name:
            return Response({"policies": {}})
        
        policies = ClientAccessPolicy.objects.filter(user=request.user, client_name=client_name)
        policy_map = {p.allowed_context: p.is_allowed for p in policies}
        return Response({"policies": policy_map})

# ==================== GDPR Article 20 and Article 17 Views ====================

class ExportUserDataView(APIView):
    """GDPR Article 20: export the complete Sovereign Data Vault as JSON."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        export_data = {
            "owner": {"username": user.username, "email": user.email},
            "system_contexts": [],
            "custom_contexts": [],
            "api_keys": [],
            "audit_logs": []
        }

        # Export static contexts.
        for p in ContextProfile.objects.filter(user=user):
            attrs = [{"key": a.attribute_key, "val": a.attribute_value, "private": a.is_private} for a in p.dynamic_attributes.all()]
            export_data["system_contexts"].append({"context_type": p.context_type, "display_name": p.display_name, "attributes": attrs})

        # Export dynamic contexts.
        for c in UserDefinedContext.objects.filter(user=user):
            attrs = [{"key": a.attribute_key, "val": a.attribute_value, "private": a.is_private} for a in c.attributes.all()]
            export_data["custom_contexts"].append({"context_name": c.context_name, "display_title": c.display_title, "attributes": attrs})

        # Export API keys.
        for k in UserAPIKey.objects.filter(user=user):
            export_data["api_keys"].append({"key_name": k.key_name, "api_key": k.api_key, "is_active": k.is_active})

        # Export audit logs.
        for l in AccessHistory.objects.filter(user=user):
            export_data["audit_logs"].append({
                "client": l.client_name, "realm": l.requested_context, 
                "status": l.access_status, "time": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            })

        return Response(export_data, status=status.HTTP_200_OK)


class PurgeUserDataView(APIView):
    """GDPR Article 17: permanently delete the user's identity data and history."""
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        ContextProfile.objects.filter(user=user).delete()
        UserDefinedContext.objects.filter(user=user).delete()
        PrivacyPolicy.objects.filter(user=user).delete()
        ClientAccessPolicy.objects.filter(user=user).delete()
        UserAPIKey.objects.filter(user=user).delete()
        AccessHistory.objects.filter(user=user).delete()

        return Response({"message": "GDPR Compliance: All sovereign identity records physically purged."}, status=status.HTTP_200_OK)

# =========================================================
# 2. PurgeUserDataView for the GDPR Right to be Forgotten.
# =========================================================
class PurgeUserDataView(APIView):
    """Permanently delete the user's contexts, attributes, policies, and API keys."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Delete related records in dependency order.
        StaticContextAttribute.objects.filter(context_profile__user=user).delete()
        ContextProfile.objects.filter(user=user).delete()
        DynamicContextAttribute.objects.filter(dynamic_context__user=user).delete()
        UserDefinedContext.objects.filter(user=user).delete()
        ClientAccessPolicy.objects.filter(user=user).delete()
        UserAPIKey.objects.filter(user=user).delete()
        AccessHistory.objects.filter(user=user).delete()

        return Response({
            "message": "GDPR Right to be Forgotten executed. All sovereign data has been permanently purged."
        }, status=status.HTTP_200_OK)

class FileUploadView(APIView):
    """
    General file upload endpoint that stores files under media/ and returns a relative URL.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES['file']
        
        # Restrict uploads to supported document and image formats.
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in ['.pdf', '.png', '.jpg', '.jpeg', '.docx']:
            return Response({"error": "Unsupported file format. Allowed: PDF, PNG, JPG, DOCX."}, status=status.HTTP_400_BAD_REQUEST)

        fs = FileSystemStorage(location=os.path.join(settings.MEDIA_ROOT, 'uploads'))
        filename = fs.save(f"{request.user.username}_{uploaded_file.name}", uploaded_file)
        file_url = f"/media/uploads/{filename}"

        return Response({
            "message": "File uploaded successfully.",
            "file_url": file_url,
            "filename": uploaded_file.name
        }, status=status.HTTP_201_CREATED)