from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_column, utcnow
from .enums import Sex

if TYPE_CHECKING:
    from .prediction import Prediction
    from .user import User


class Patient(TimestampMixin, db.Model):
    """Demographic and baseline clinical profile of a patient."""

    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    assigned_doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    sex: Mapped[Sex | None] = mapped_column(enum_column(Sex))
    phone: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(5))
    height_cm: Mapped[float | None] = mapped_column(Float)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    medical_history: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="patient_profile", foreign_keys=[user_id])
    assigned_doctor: Mapped[User | None] = relationship(foreign_keys=[assigned_doctor_id])
    predictions: Mapped[list[Prediction]] = relationship(
        back_populates="patient", cascade="all, delete-orphan", order_by="Prediction.created_at"
    )

    @property
    def age(self) -> int | None:
        if not self.date_of_birth:
            return None
        today = date.today()
        dob = self.date_of_birth
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    @property
    def bmi(self) -> float | None:
        if not (self.height_cm and self.weight_kg):
            return None
        return round(self.weight_kg / (self.height_cm / 100) ** 2, 1)
