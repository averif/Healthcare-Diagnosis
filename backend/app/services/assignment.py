"""Automatic doctor assignment: give each patient the least-loaded approved, active doctor."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import func, or_

from ..extensions import db
from ..models import DoctorProfile, DoctorStatus, Patient, Role, User


def least_loaded_doctor(exclude_ids: Iterable[int] = ()) -> User | None:
    """The approved, active doctor with the fewest assigned patients (ties: oldest account).

    Admin-created doctors have no DoctorProfile and count as verified; self-registered doctors
    must have an approved profile.
    """
    load = (
        db.select(Patient.assigned_doctor_id.label("doctor_id"), func.count(Patient.id).label("n"))
        .where(Patient.assigned_doctor_id.is_not(None))
        .group_by(Patient.assigned_doctor_id)
        .subquery()
    )
    stmt = (
        db.select(User)
        .outerjoin(DoctorProfile, DoctorProfile.user_id == User.id)
        .outerjoin(load, load.c.doctor_id == User.id)
        .where(
            User.role == Role.DOCTOR,
            User.is_active.is_(True),
            or_(DoctorProfile.id.is_(None), DoctorProfile.status == DoctorStatus.APPROVED),
        )
        .order_by(func.coalesce(load.c.n, 0), User.id)
        .limit(1)
    )
    exclude = list(exclude_ids)
    if exclude:
        stmt = stmt.where(User.id.not_in(exclude))
    return db.session.scalar(stmt)


def auto_assign(patient: Patient, exclude_ids: Iterable[int] = ()) -> User | None:
    """Assign the least-loaded doctor; leaves the patient unassigned when none is available."""
    doctor = least_loaded_doctor(exclude_ids)
    patient.assigned_doctor_id = doctor.id if doctor else None
    db.session.flush()  # later picks in the same transaction see the updated load
    return doctor


def assign_unassigned() -> tuple[int, int]:
    """Backfill every unassigned patient. Returns (assigned, still_unassigned)."""
    patients = db.session.scalars(
        db.select(Patient).where(Patient.assigned_doctor_id.is_(None)).order_by(Patient.id)
    ).all()
    assigned = sum(1 for p in patients if auto_assign(p) is not None)
    return assigned, len(patients) - assigned


def reassign_patients_of(doctor: User) -> int:
    """Move a doctor's patients to other doctors (e.g. when the doctor is deactivated)."""
    patients = db.session.scalars(
        db.select(Patient).where(Patient.assigned_doctor_id == doctor.id).order_by(Patient.id)
    ).all()
    for patient in patients:
        auto_assign(patient, exclude_ids=[doctor.id])
    return len(patients)
