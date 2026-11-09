"""AI clinical assistant endpoints: ask about a prediction, read the conversation history."""

from __future__ import annotations

from flask import current_app
from flask_jwt_extended import current_user
from flask_smorest import Blueprint
from marshmallow import Schema, fields, validate

from ..extensions import db, limiter
from ..models import ChatMessage, ChatRole, Role
from ..security import BEARER, audit, get_prediction_or_404, roles_required

blp = Blueprint("assistant", __name__, url_prefix="/assistant", description="AI assistant")


class ChatRequestSchema(Schema):
    message = fields.String(required=True, validate=validate.Length(min=1, max=1000))
    prediction_id = fields.Integer(load_default=None)


class ChatMessageSchema(Schema):
    id = fields.Integer()
    role = fields.Enum(ChatRole, by_value=True)
    content = fields.String()
    prediction_id = fields.Integer(allow_none=True)
    created_at = fields.DateTime()


class ChatReplySchema(Schema):
    reply = fields.Nested(ChatMessageSchema)
    provider = fields.String(metadata={"description": "nvidia, claude, rules or safety"})
    emergency = fields.Boolean()


class HistoryQuerySchema(Schema):
    prediction_id = fields.Integer(load_default=None)


class AssistantStatusSchema(Schema):
    provider = fields.String()
    detail = fields.String(
        metadata={"description": "Model in use, or why the assistant is offline"}
    )


def _assistant():
    return current_app.extensions["assistant"]


def _history_stmt(prediction_id: int | None):
    stmt = db.select(ChatMessage).where(ChatMessage.user_id == current_user.id)
    if prediction_id is None:
        return stmt.where(ChatMessage.prediction_id.is_(None))
    return stmt.where(ChatMessage.prediction_id == prediction_id)


@blp.route("/status", methods=["GET"])
@roles_required(Role.PATIENT, Role.DOCTOR)
@blp.response(200, AssistantStatusSchema)
@blp.doc(security=BEARER)
def status():
    """Which provider is answering: `nvidia` or `claude` (API key configured), or `rules`."""
    assistant = _assistant()
    return {"provider": assistant.provider_name, "detail": assistant.detail}


@blp.route("/chat", methods=["POST"])
@limiter.limit("20 per minute")
@roles_required(Role.PATIENT, Role.DOCTOR)
@blp.arguments(ChatRequestSchema)
@blp.response(200, ChatReplySchema)
@blp.doc(security=BEARER)
def chat(data):
    """Ask the assistant about a prediction (or in general when no prediction_id is given)."""
    prediction = None
    if data["prediction_id"] is not None:
        prediction = get_prediction_or_404(data["prediction_id"])

    previous = db.session.scalars(
        _history_stmt(data["prediction_id"]).order_by(ChatMessage.id.desc()).limit(8)
    ).all()
    history = [{"role": m.role.value, "content": m.content} for m in reversed(previous)]

    question = data["message"].strip()
    result = _assistant().answer(question, prediction, history)

    db.session.add(
        ChatMessage(
            user_id=current_user.id,
            prediction_id=data["prediction_id"],
            role=ChatRole.USER,
            content=question,
        )
    )
    reply = ChatMessage(
        user_id=current_user.id,
        prediction_id=data["prediction_id"],
        role=ChatRole.ASSISTANT,
        content=result.text,
    )
    db.session.add(reply)
    if result.emergency:
        audit("assistant.emergency", "prediction", data["prediction_id"])
    db.session.commit()
    return {"reply": reply, "provider": result.provider, "emergency": result.emergency}


@blp.route("/history", methods=["GET"])
@roles_required(Role.PATIENT, Role.DOCTOR)
@blp.arguments(HistoryQuerySchema, location="query")
@blp.response(200, ChatMessageSchema(many=True))
@blp.doc(security=BEARER)
def history(query):
    """The caller's own conversation about one prediction, oldest first."""
    if query["prediction_id"] is not None:
        get_prediction_or_404(query["prediction_id"])
    return db.session.scalars(_history_stmt(query["prediction_id"]).order_by(ChatMessage.id)).all()
