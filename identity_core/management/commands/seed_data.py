from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from identity_core.models import (
    ContextProfile, 
    StaticContextAttribute, 
    PrivacyPolicy, 
    UserAPIKey, 
    AccessHistory
)

class Command(BaseCommand):
    help = "Seeds the database with high-quality multi-context dummy data and API keys for testing."

    def handle(self, *args, **options):
        self.stdout.write("Seeding data...")

        # 1. Clear existing data to avoid foreign-key conflicts.
        AccessHistory.objects.all().delete()
        UserAPIKey.objects.all().delete()
        StaticContextAttribute.objects.all().delete()
        ContextProfile.objects.all().delete()
        PrivacyPolicy.objects.all().delete()
        User.objects.filter(username="teo_tian_yu").delete()

        # 2. Create the test owner account.
        user = User.objects.create_user(
            username="teo_tian_yu", 
            password="password123", 
            email="teo@gmail.com"
        )

        # 3. Add the professional context.
        prof_profile = ContextProfile.objects.create(
            user=user,
            context_type="professional",
            display_name="Tian Yu Teo",
            pronouns="He/Him"
        )
        StaticContextAttribute.objects.create(context_profile=prof_profile, attribute_key="working_location", attribute_value="Johor Bahru", is_private=False)
        StaticContextAttribute.objects.create(context_profile=prof_profile, attribute_key="company_name", attribute_value="Hosay Food Sdn Bhd", is_private=False)
        StaticContextAttribute.objects.create(context_profile=prof_profile, attribute_key="company_link", attribute_value="https://hosayfood.com.my", is_private=False)
        StaticContextAttribute.objects.create(context_profile=prof_profile, attribute_key="confidential_description", attribute_value="Evaluating full-stack frameworks for local retail IoT tracking systems.", is_private=True)

        # 4. Add the gaming and social context.
        game_profile = ContextProfile.objects.create(
            user=user,
            context_type="gaming_social",
            display_name="Teddy Go",
            pronouns="They/Them"
        )
        StaticContextAttribute.objects.create(context_profile=game_profile, attribute_key="favorite_rpg", attribute_value="Genshin Impact", is_private=False)
        StaticContextAttribute.objects.create(context_profile=game_profile, attribute_key="discord_tag", attribute_value="TeddyGo#9999", is_private=False)

        # 5. Initialize privacy policies.
        PrivacyPolicy.objects.create(user=user, context_type="professional", is_context_enabled=True)
        PrivacyPolicy.objects.create(user=user, context_type="gaming_social", is_context_enabled=True)

        # 6. Create API keys for use by the frontend sandbox.
        UserAPIKey.objects.create(
            user=user,
            key_name="LinkedIn Recruiter",
            api_key="sk_live_linkedin_998x",
            allowed_context="professional",
            is_active=True
        )
        UserAPIKey.objects.create(
            user=user,
            key_name="Malicious Scraper",
            api_key="sk_live_bad_scraper_000x",
            allowed_context="professional",
            is_active=False  # Disabled by default to test ban enforcement.
        )

        self.stdout.write(self.style.SUCCESS("Successfully seeded database with Users, Contexts, EAV Attributes, and API Keys!"))