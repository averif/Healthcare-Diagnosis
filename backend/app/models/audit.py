from __future__ import annotations

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import TimestampMixin, enum_column
from .enums import ChatRole


class AuditLog(TimestampMixin, db.Model):
    """Who did what to which record, and when (e.g. a doctor viewing a patient's history)."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(50), index=True)  # e.g. "prediction.create"
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[int | None] = mapped_column(Integer)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    details: Mapped[dict | None] = mapped_column(JSON)


class ChatMessage(TimestampMixin, db.Model):
    """Conversation with the AI clinical assistant, optionally grounded in one prediction."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    prediction_id: Mapped[int | None] = mapped_column(
        ForeignKey("predictions.id", ondelete="SET NULL")
    )
    role: Mapped[ChatRole] = mapped_column(enum_column(ChatRole))
    content: Mapped[str] = mapped_column(Text)
