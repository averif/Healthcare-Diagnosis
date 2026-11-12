from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin, enum_column
from .enums import DoctorStatus, Role

if TYPE_CHECKING:
    from .doctor_profile import DoctorProfile
    from .patient import Patient

_hasher = PasswordHasher()


class User(TimestampMixin, db.Model):
    """A login account. Every person (patient, doctor, admin) has exactly one."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(enum_column(Role), default=Role.PATIENT)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # A patient-role user owns one patient profile
    patient_profile: Mapped[Patient | None] = relationship(
        back_populates="user", foreign_keys="Patient.user_id", uselist=False
    )
    # A self-registered doctor's verification record (none for admin-created accounts)
    doctor_profile: Mapped[DoctorProfile | None] = relationship(
        back_populates="user", foreign_keys="DoctorProfile.user_id", uselist=False
    )

    @property
    def is_doctor_applicant(self) -> bool:
        """A doctor sign-up that an admin has not (yet) approved: no clinical access at all."""
        return (
            self.doctor_profile is not None and self.doctor_profile.status != DoctorStatus.APPROVED
        )

    def set_password(self, password: str) -> None:
        self.password_hash = _hasher.hash(password)

    def check_password(self, password: str) -> bool:
        try:
            return _hasher.verify(self.password_hash, password)
        except VerifyMismatchError:
            return False

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
