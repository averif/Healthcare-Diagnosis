from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db
from .base import enum_column, utcnow
from .enums import Disease


class ModelVersion(db.Model):
    """Registry of trained models, so every prediction is traceable to the exact model used."""

    __tablename__ = "model_registry"
    __table_args__ = (UniqueConstraint("disease", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    disease: Mapped[Disease] = mapped_column(enum_column(Disease), index=True)
    version: Mapped[str] = mapped_column(String(20))
    algorithm: Mapped[str] = mapped_column(String(60), default="DecisionTreeClassifier")
    file_path: Mapped[str] = mapped_column(String(255))
    features: Mapped[list] = mapped_column(JSON)  # ordered input feature names
    metrics: Mapped[dict] = mapped_column(JSON)  # accuracy, precision, recall, f1, roc_auc...
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
