from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_column
from .enums import ReviewVerdict

if TYPE_CHECKING:
    from .prediction import Prediction
    from .user import User


class DoctorReview(TimestampMixin, db.Model):
    """Human-in-the-loop: a doctor's verdict and notes on an AI prediction."""

    __tablename__ = "doctor_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), unique=True
    )
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    verdict: Mapped[ReviewVerdict] = mapped_column(enum_column(ReviewVerdict))
    notes: Mapped[str | None] = mapped_column(Text)

    prediction: Mapped[Prediction] = relationship(back_populates="review")
    doctor: Mapped[User | None] = relationship()
