"""Application configuration, loaded from environment variables (.env in development)."""

import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
PROJECT_ROOT = BASE_DIR.parent


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me")
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

    # AI clinical assistant (Phase 4): "claude", "gemini" or "rules" (offline fallback)
    ASSISTANT_PROVIDER = os.getenv("ASSISTANT_PROVIDER", "rules")

    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")

    # flask-smorest / OpenAPI
    API_TITLE = "MediAssist CDSS API"
    API_VERSION = "0.1.0"
    OPENAPI_VERSION = "3.0.3"
    OPENAPI_URL_PREFIX = "/api"
    OPENAPI_SWAGGER_UI_PATH = "/docs"
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
