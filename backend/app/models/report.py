from __future__ import annotations

import secrets
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin

if TYPE_CHECKING:
    from .prediction import Prediction
    from .user import User


def new_report_code() -> str:
    """Short, unguessable public ID printed on the PDF (e.g. RPT-7F3K9Q2M)."""
    return "RPT-" + secrets.token_hex(4).upper()


class Report(TimestampMixin, db.Model):
    """A generated PDF report for a prediction."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_code: Mapped[str] = mapped_column(String(20), unique=True, default=new_report_code)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), index=True
    )
    generated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    file_path: Mapped[str] = mapped_column(String(255))

    prediction: Mapped[Prediction] = relationship(back_populates="reports")
    generated_by: Mapped[User | None] = relationship()
