"""Application factory for the MediAssist Clinical Decision Support System API."""

import os

from dotenv import load_dotenv

# Load backend/.env before config.py reads os.environ (matters under gunicorn, where
# `flask run`'s own .env loading does not happen)
load_dotenv()

from flask import Flask  # noqa: E402

from .config import config_by_name  # noqa: E402
from .extensions import cors, db, jwt, limiter, migrate, rest_api  # noqa: E402


def create_app(config_name: str | None = None, overrides: dict | None = None) -> Flask:
    config_name = config_name or os.getenv("FLASK_ENV", "development")

    app = Flask(__name__, instance_relative_config=True)
    config_class = config_by_name[config_name]
    if hasattr(config_class, "validate"):
        config_class.validate()
    app.config.from_object(config_class)
    app.config.update(overrides or {})
    os.makedirs(app.instance_path, exist_ok=True)
    if app.config["BEHIND_PROXY"]:
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        expose_headers=["Content-Disposition", "X-Report-Code"],
    )
    limiter.init_app(app)
    rest_api.init_app(app)

    from . import models  # noqa: F401  (register models with SQLAlchemy metadata)
    from .api import admin, assistant, auth, dashboard, health, patients, predictions
    from .cli import register_cli
    from .security import init_jwt
    from .services.assistant import ClinicalAssistant
    from .services.predictor import PredictionService

    init_jwt(app)
    app.extensions["prediction_service"] = PredictionService(app.config["MODELS_DIR"])
    app.extensions["assistant"] = ClinicalAssistant(
        app.config["ASSISTANT_PROVIDER"], app.config["ASSISTANT_MODEL"]
    )

    for blueprint in (
        health.blp,
        auth.blp,
        patients.blp,
        predictions.blp,
        predictions.reports_blp,
        dashboard.blp,
        dashboard.models_blp,
        admin.blp,
        assistant.blp,
    ):
        rest_api.register_blueprint(blueprint, url_prefix=f"/api{blueprint.url_prefix or ''}")
    register_cli(app)

    return app
