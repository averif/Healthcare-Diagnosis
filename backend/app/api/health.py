"""Health-check endpoint used by the frontend, Docker and CI to confirm the API is up."""

from flask import current_app
from flask_smorest import Blueprint
from marshmallow import Schema, fields
from sqlalchemy import text

from ..extensions import db

blp = Blueprint("health", __name__, description="Service health")


class HealthSchema(Schema):
    status = fields.String(required=True)
    version = fields.String(required=True)
    database = fields.String(required=True)
    assistant = fields.String(
        required=True, metadata={"description": "Active AI assistant: nvidia, claude or rules"}
    )


@blp.route("/health")
@blp.response(200, HealthSchema)
def health():
    """Report API and database status."""
    try:
        db.session.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # pragma: no cover - only hit when the DB is down
        database = "unavailable"
    return {
        "status": "ok",
        "version": current_app.config["API_VERSION"],
        "database": database,
        "assistant": current_app.extensions["assistant"].provider_name,
    }
