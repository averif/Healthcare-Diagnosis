from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_column
from .enums import DoctorStatus

if TYPE_CHECKING:
    from .user import User


class DoctorProfile(TimestampMixin, db.Model):
    """Proof of registration submitted by a self-registered doctor, verified by an admin.

    The account keeps role=patient (with no patient profile, so it sees no patient data)
    until an admin approves the application; approval flips the role to doctor.
    """

    __tablename__ = "doctor_profiles"
    # One medical licence can back only one account
    __table_args__ = (
        UniqueConstraint(
            "issuing_authority", "license_number", name="uq_doctor_profiles_authority_license"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    license_number: Mapped[str] = mapped_column(String(50))
    issuing_authority: Mapped[str] = mapped_column(String(120))
    hospital: Mapped[str | None] = mapped_column(String(120))
    specialty: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[DoctorStatus] = mapped_column(
        enum_column(DoctorStatus), default=DoctorStatus.PENDING, index=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # File name only (random), inside DOCTOR_DOCS_DIR; never a client-supplied path
    document_path: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="doctor_profile", foreign_keys=[user_id])
    reviewed_by: Mapped[User | None] = relationship(foreign_keys=[reviewed_by_id])
