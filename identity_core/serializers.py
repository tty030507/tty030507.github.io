from rest_framework import serializers
from django.contrib.auth.models import User
from identity_core.models import ContextProfile, StaticContextAttribute, UserAPIKey

class UserRegisterSerializer(serializers.ModelSerializer):
    """Serialize user registration data."""
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'email']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', '')
        )
        return user

class StaticContextAttributeSerializer(serializers.ModelSerializer):
    """Serialize static attributes and conceal private values."""
    class Meta:
        model = StaticContextAttribute
        fields = ['attribute_key', 'attribute_value', 'is_private']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.is_private:
            ret['attribute_value'] = "🔑 [CONCEALED: Private Attribute]"
        return ret

class ContextProfileSerializer(serializers.ModelSerializer):
    """Serialize a context profile with nested attributes."""
    dynamic_attributes = StaticContextAttributeSerializer(many=True, read_only=True)

    class Meta:
        model = ContextProfile
        fields = ['context_type', 'display_name', 'pronouns', 'dynamic_attributes']

class UserAPIKeySerializer(serializers.ModelSerializer):
    """Serialize API key governance data."""
    class Meta:
        model = UserAPIKey
        fields = ['id', 'key_name', 'api_key', 'allowed_context', 'is_active', 'created_at']