from django.urls import path
from identity_core.views import (
    RegisterView, LoginView, PasswordResetView, UserProfileView, AddCustomAttributeView,
    CreateUserContextView, ListUserContextView, CreateAPIKeyView,
    ToggleAPIKeyBanView, ListAPIKeysView, UpdateAPIKeyScopeView, GetAccessHistoryLogView,
    GetAPIKeyPoliciesView, ExportUserDataView, PurgeUserDataView,FileUploadView
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # Identity authentication and token routes.
    path('register/', RegisterView.as_view(), name='api_register'),
    path('login/', LoginView.as_view(), name='api_login'), 
    path('password-reset/', PasswordResetView.as_view(), name='api_password_reset'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('upload/', FileUploadView.as_view(), name='api_upload'),
    # Context and attribute gateway routes.
    path('profile/', UserProfileView.as_view(), name='api_profile'),
    path('attribute/add/', AddCustomAttributeView.as_view(), name='api_attribute_add'),
    path('context/create/', CreateUserContextView.as_view(), name='api_context_create'),
    path('context/list/', ListUserContextView.as_view(), name='api_context_list'),
    path('vault/purge/', PurgeUserDataView.as_view(), name='api_vault_purge'),
    
    # API key governance and blacklist controls.
    path('key/create/', CreateAPIKeyView.as_view(), name='api_key_create'),
    path('key/toggle-ban/', ToggleAPIKeyBanView.as_view(), name='api_key_toggle_ban'),
    path('key/list/', ListAPIKeysView.as_view(), name='api_key_list'),
    path('key/scope-policy/', UpdateAPIKeyScopeView.as_view(), name='api_key_scope_policy'),
    path('key/policies/', GetAPIKeyPoliciesView.as_view(), name='api_key_policies'),
    
    # Audit dashboard and GDPR routes.
    path('policy/audit-logs/', GetAccessHistoryLogView.as_view(), name='api_audit_logs'),
    path('gdpr/export/', ExportUserDataView.as_view(), name='api_gdpr_export'),
    path('gdpr/purge/', PurgeUserDataView.as_view(), name='api_gdpr_purge'),
]