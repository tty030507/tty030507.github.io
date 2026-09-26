# Sovereign Identity Management Gateway API

A privacy-centric, RFC 9110-compliant identity delegation gateway designed for dynamic user context management and zero-trust API authorization.

## 🌟 Key Features
* **EAV Context Architecture**: Flexible Entity-Attribute-Value profile model allowing zero-schema attribute additions across contexts (e.g., Professional, Gaming).
* **ABAC & Zero-Trust Governance**: Granular access control (`ClientAccessPolicy`) with server-side private attribute concealment (`is_private` attribute masking).
* **RFC 9110 Content Negotiation**: Multi-language identity payload translation using Google Cloud Translation API with local dictionary fallback.
* **Secure Sovereign File Storage**: Context-bound media/document attachment (`FileUploadView`) with gateway-enforced URL masking.
* **GDPR Compliance**: Built-in compliance with Article 17 (Right to be Forgotten) via physical vault purge endpoints (`/api/vault/purge/`).

## 🛠️ Tech Stack
* **Backend**: Django, Django REST Framework (DRF), SimpleJWT
* **Frontend**: React.js
* **API Documentation**: OpenAPI 3.0 / Swagger UI (`drf-spectacular`)
* **External Integration**: Google Cloud Translation API

## 🚀 Getting Started

### 1. Environment Setup
```bash
# Clone repository and enter project directory
cd FYP_Code

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

2. Database & Migrations
Bash
python manage.py makemigrations
python manage.py migrate
3. Running the Gateway
Bash
python manage.py runserver
API Gateway Base: http://127.0.0.1:8000/api/

Swagger UI Documentation: http://127.0.0.1:8000/swagger/

4. Running Automated Unit Tests
Bash
python manage.py test identity_core -v 2