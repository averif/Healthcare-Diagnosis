from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import JSON, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_column
from .enums import Disease, PredictionStatus, RiskLevel

if TYPE_CHECKING:
    from .ml_model import ModelVersion
    from .patient import Patient
    from .report import Report
    from .review import DoctorReview
    from .user import User


class Prediction(TimestampMixin, db.Model):
    """One model run: inputs, output, probability, risk band and the explanation shown to users."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    model_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("model_registry.id", ondelete="SET NULL")
    )
    disease: Mapped[Disease] = mapped_column(enum_column(Disease), index=True)
    input_data: Mapped[dict] = mapped_column(JSON)
    predicted_label: Mapped[str] = mapped_column(String(120))
    probability: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[RiskLevel] = mapped_column(enum_column(RiskLevel))
    # Decision path + top contributing features, rendered as plain-English reasons
    explanation: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[PredictionStatus] = mapped_column(
        enum_column(PredictionStatus), default=PredictionStatus.PENDING_REVIEW, index=True
    )

    patient: Mapped[Patient] = relationship(back_populates="predictions")
    created_by: Mapped[User | None] = relationship()
    model_version: Mapped[ModelVersion | None] = relationship()
    review: Mapped[DoctorReview | None] = relationship(
        back_populates="prediction", cascade="all, delete-orphan", uselist=False
    )
    reports: Mapped[list[Report]] = relationship(
        back_populates="prediction", cascade="all, delete-orphan"
    )
