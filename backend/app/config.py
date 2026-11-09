"""Application configuration, loaded from environment variables (.env in development)."""

import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
PROJECT_ROOT = BASE_DIR.parent


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production-0000")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me-in-production-00")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7")))

    # SQLite by default; set DATABASE_URL=mysql+pymysql://user:pass@host/db for MySQL
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'instance' / 'healthcare.db'}"
    )
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

    # Trained models live in /ml/models (produced by the ML pipeline in Phase 2)
    MODELS_DIR = Path(os.getenv("MODELS_DIR", str(PROJECT_ROOT / "ml" / "models")))
    REPORTS_DIR = Path(os.getenv("REPORTS_DIR", str(BASE_DIR / "generated_reports")))

    # AI clinical assistant: "auto" uses NVIDIA when NVIDIA_API_KEY is set, else Claude when
    # ANTHROPIC_API_KEY is set, else offline rules. Force with "nvidia", "claude" or "rules".
    ASSISTANT_PROVIDER = os.getenv("ASSISTANT_PROVIDER", "auto")
    ASSISTANT_MODEL = os.getenv("ASSISTANT_MODEL", "claude-opus-5-5")
    NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
    NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NVIDIA_REASONING = os.getenv("NVIDIA_REASONING", "0") == "1"  # slower; rarely needed

    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")

    # Behind a reverse proxy (nginx in Docker): trust one X-Forwarded-For hop so rate limits
    # and the audit log see the real client IP instead of the proxy's
    BEHIND_PROXY = os.getenv("BEHIND_PROXY", "0") == "1"

    # flask-smorest / OpenAPI
    API_TITLE = "MediAssist CDSS API"
    API_VERSION = "0.1.0"
    OPENAPI_VERSION = "3.0.3"
    OPENAPI_URL_PREFIX = "/api"
    OPENAPI_SWAGGER_UI_PATH = "/docs"
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"
    API_SPEC_OPTIONS = {
        "info": {
            "description": "Explainable, Decision Tree based clinical decision support. "
            "Click **Authorize** and paste an access token from `POST /api/auth/login`."
        },
        "components": {
            "securitySchemes": {
                "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
            }
        },
    }

    # Rate limits for authentication endpoints (brute-force protection)
    LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10 per minute")
    REGISTER_RATE_LIMIT = os.getenv("REGISTER_RATE_LIMIT", "5 per minute")


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
    ASSISTANT_PROVIDER = "rules"  # tests never call the paid API
    REPORTS_DIR = Path(os.getenv("TEST_REPORTS_DIR", str(BASE_DIR / "instance" / "test_reports")))


class ProductionConfig(Config):
    DEBUG = False
    PREFERRED_URL_SCHEME = "https"

    @classmethod
    def validate(cls) -> None:
        """Refuse to start in production with the built-in development secrets."""
        for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
            value = os.getenv(name, "")
            if len(value) < 32 or "change-me" in value:
                raise RuntimeError(
                    f"{name} must be set to a random string of at least 32 characters in "
                    'production (e.g. python -c "import secrets; print(secrets.token_urlsafe(48))")'
                )


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
