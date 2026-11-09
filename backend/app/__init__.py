"""Application factory for the MediAssist Clinical Decision Support System API."""

import os

from dotenv import load_dotenv
from flask import Flask

from .config import config_by_name
from .extensions import cors, db, jwt, limiter, migrate, rest_api


def create_app(config_name: str | None = None) -> Flask:
    load_dotenv()
    config_name = config_name or os.getenv("FLASK_ENV", "development")

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_by_name[config_name])
    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    limiter.init_app(app)
    rest_api.init_app(app)

    from . import models  # noqa: F401  (register models with SQLAlchemy metadata)
    from .api.health import blp as health_blp
    from .cli import register_cli

    rest_api.register_blueprint(health_blp, url_prefix="/api")
    register_cli(app)

    return app
