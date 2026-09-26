from django.http import JsonResponse

class PrivacyContextMiddleware:
    """Reject third-party profile requests without context or client identity headers."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Allow CORS preflight requests to pass through without authentication checks.
        if request.method == 'OPTIONS':
            return self.get_response(request)

        # Validate required headers for the profile gateway endpoint.
        if request.path == '/api/profile/' and request.method == 'GET':
            requested_context = request.headers.get('X-Context') or request.GET.get('context')
            client_source = request.headers.get('X-Client-Source')

            if not requested_context:
                return JsonResponse({
                    "error": "Security Block: Missing explicit X-Context HTTP Header or Query Param."
                }, status=400)
                
            if not client_source:
                return JsonResponse({
                    "error": "Security Block: Missing explicit X-Client-Source HTTP Header."
                }, status=400)
                
        response = self.get_response(request)
        return response