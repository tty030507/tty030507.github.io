from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView 
from django.conf import settings               # Import project configuration settings
from django.conf.urls.static import static     # Helper function to serve static/media files during development

from drf_spectacular.views import (
    SpectacularAPIView, 
    SpectacularSwaggerView, 
    SpectacularRedocView
)

urlpatterns = [
    # Django admin site.
    path('admin/', admin.site.urls),
    
    # Interactive Swagger and ReDoc API documentation routes.
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # React frontend entry page.
    path('', TemplateView.as_view(template_name='index.html'), name='index_page'),
    
    # Forward all /api/ requests to the identity_core application.
    path('api/', include('identity_core.urls')),
    
]

if settings.DEBUG:
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)