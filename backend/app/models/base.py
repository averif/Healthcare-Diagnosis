"""Reusable column helpers for models."""

from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC)


def enum_column(enum_cls: type[Enum]) -> SAEnum:
    """Store enum *values* as VARCHAR + CHECK, which behaves the same on SQLite and MySQL."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
        length=32,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
