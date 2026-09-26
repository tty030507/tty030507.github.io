from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    """Extend Django's built-in User model with an OAuth identifier."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True, default=None)

    def __str__(self):
        return self.user.username


# ==================== Architecture A: Static Context ====================

class ContextProfile(models.Model):
    """Store the user's predefined context categories."""
    CONTEXT_CHOICES = [
        ('professional', 'Professional'),
        ('gaming_social', 'Gaming & Social'),
        ('sports', 'Sports'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contexts')
    context_type = models.CharField(max_length=30, choices=CONTEXT_CHOICES)
    display_name = models.CharField(max_length=100)
    pronouns = models.CharField(max_length=30, blank=True, null=True)

    class Meta:
        unique_together = ('user', 'context_type')

    def __str__(self):
        return f"{self.user.username} - {self.context_type}"


class StaticContextAttribute(models.Model):
    """Store EAV attributes for static contexts, including privacy flags."""
    context_profile = models.ForeignKey(ContextProfile, on_delete=models.CASCADE, related_name='dynamic_attributes')
    attribute_key = models.CharField(max_length=100)
    attribute_value = models.TextField()
    is_private = models.BooleanField(default=False)

    def __str__(self):
        return f"Static: {self.context_profile.context_type} - {self.attribute_key}"


# ==================== Architecture B: Dynamic Context ====================

class UserDefinedContext(models.Model):
    """Store context categories created by users."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_contexts')
    context_name = models.CharField(max_length=50)
    display_title = models.CharField(max_length=100)

    class Meta:
        unique_together = ('user', 'context_name')

    def __str__(self):
        return f"Custom: {self.user.username} - {self.context_name}"


class DynamicContextAttribute(models.Model):
    """Store EAV attributes for user-defined contexts."""
    dynamic_context = models.ForeignKey(UserDefinedContext, on_delete=models.CASCADE, related_name='attributes')
    attribute_key = models.CharField(max_length=100)
    attribute_value = models.TextField()
    is_private = models.BooleanField(default=False)

    def __str__(self):
        return f"Dynamic: {self.dynamic_context.context_name} - {self.attribute_key}"


# ==================== Architecture C: Security Policy Matrix ====================

class PrivacyPolicy(models.Model):
    """Store the global enablement flag for a context category."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='privacy_policies')
    context_type = models.CharField(max_length=30)
    is_context_enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ('user', 'context_type')


class ClientAccessPolicy(models.Model):
    """Control third-party client allowlists and blocklists."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='client_policies')
    client_name = models.CharField(max_length=100)      # Request source, such as LinkedIn or Discord.
    allowed_context = models.CharField(max_length=30)   # Context allowed for this client.
    is_allowed = models.BooleanField(default=True)       # Allow or deny flag.

    class Meta:
        unique_together = ('user', 'client_name', 'allowed_context')

    def __str__(self):
        return f"{self.user.username} Policy: Allow {self.client_name} -> {self.allowed_context} ({self.is_allowed})"

class UserAPIKey(models.Model):
    """Store API keys issued to third-party clients."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_keys')
    key_name = models.CharField(max_length=100)          # Key label, such as LinkedIn API Key.
    api_key = models.CharField(max_length=255, unique=True) # API key value.
    allowed_context = models.CharField(max_length=50)   # Allowed scope.
    is_active = models.BooleanField(default=True)        # Permanent ban switch.
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.key_name} ({'Active' if self.is_active else 'Banned'})"


# ==================== Architecture D: Access Audit History ====================

class AccessHistory(models.Model):
    """Store tamper-resistant audit records for third-party requests."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_histories')
    client_name = models.CharField(max_length=100)
    requested_context = models.CharField(max_length=50)
    timestamp = models.DateTimeField(auto_now_add=True)
    access_status = models.CharField(max_length=20)     # "ALLOWED" or "BLOCKED".

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.client_name} -> {self.requested_context} ({self.access_status}) at {self.timestamp}"