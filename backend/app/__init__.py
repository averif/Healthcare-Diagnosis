"""Application factory for the MediAssist Clinical Decision Support System API."""

import os

from dotenv import load_dotenv
from flask import Flask

from .config import config_by_name
from .extensions import cors, db, jwt, limiter, migrate, rest_api


def create_app(config_name: str | None = None, overrides: dict | None = None) -> Flask:
    load_dotenv()
    config_name = config_name or os.getenv("FLASK_ENV", "development")

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_by_name[config_name])
    app.config.update(overrides or {})
    os.makedirs(app.instance_path, exist_ok=True)

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
    from .api import admin, auth, dashboard, health, patients, predictions
    from .cli import register_cli
    from .security import init_jwt
    from .services.predictor import PredictionService

    init_jwt(app)
    app.extensions["prediction_service"] = PredictionService(app.config["MODELS_DIR"])

    for blueprint in (
        health.blp,
        auth.blp,
        patients.blp,
        predictions.blp,
        predictions.reports_blp,
        dashboard.blp,
        dashboard.models_blp,
        admin.blp,
    ):
        rest_api.register_blueprint(blueprint, url_prefix=f"/api{blueprint.url_prefix or ''}")
    register_cli(app)

    return app
