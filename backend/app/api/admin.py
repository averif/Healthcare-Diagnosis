"""Administration: user and role management, doctor assignment and the audit log."""

from __future__ import annotations

from flask_jwt_extended import current_user
from flask_smorest import Blueprint, abort
from sqlalchemy import or_

from ..extensions import db
from ..models import AuditLog, Patient, Role, User
from ..pagination import paginate
from ..schemas import (
    AdminUserCreateSchema,
    AdminUserQuerySchema,
    AdminUserUpdateSchema,
    AssignDoctorSchema,
    AuditPageSchema,
    AuditQuerySchema,
    PatientSchema,
    UserPageSchema,
    UserSchema,
)
from ..security import BEARER, audit, roles_required

blp = Blueprint("admin", __name__, url_prefix="/admin", description="Administration")
admin_only = roles_required(Role.ADMIN)


@blp.route("/users", methods=["GET"])
@admin_only
@blp.arguments(AdminUserQuerySchema, location="query")
@blp.response(200, UserPageSchema)
@blp.doc(security=BEARER)
def list_users(query):
    """All users, filterable by role and name/email."""
    stmt = db.select(User).order_by(User.role, User.full_name)
    if query["role"]:
        stmt = stmt.where(User.role == query["role"])
    if query["search"]:
        term = f"%{query['search'].strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
    return paginate(stmt, query["page"], query["page_size"])


@blp.route("/users", methods=["POST"])
@admin_only
@blp.arguments(AdminUserCreateSchema)
@blp.response(201, UserSchema)
@blp.doc(security=BEARER)
def create_user(data):
    """Create a doctor, admin or patient account."""
    email = data["email"].strip().lower()
    if db.session.scalar(db.select(User.id).filter_by(email=email)):
        abort(409, message="An account with this email already exists.")
    user = User(email=email, full_name=data["full_name"].strip(), role=data["role"])
    user.set_password(data["password"])
    db.session.add(user)
    if user.role == Role.PATIENT:
        db.session.add(Patient(user=user))
    db.session.flush()
    audit("admin.user_create", "user", user.id, role=user.role.value)
    db.session.commit()
    return user


@blp.route("/users/<int:user_id>", methods=["PATCH"])
@admin_only
@blp.arguments(AdminUserUpdateSchema)
@blp.response(200, UserSchema)
@blp.doc(security=BEARER)
def update_user(data, user_id: int):
    """Change a user's name, role or active status."""
    user = db.session.get(User, user_id)
    if user is None:
        abort(404, message="User not found.")
    if user.id == current_user.id and (
        data.get("is_active") is False or data.get("role", Role.ADMIN) != Role.ADMIN
    ):
        abort(400, message="You cannot deactivate or demote your own account.")
    for field, value in data.items():
        setattr(user, field, value)
    if user.role == Role.PATIENT and user.patient_profile is None:
        db.session.add(Patient(user=user))
    audit(
        "admin.user_update",
        "user",
        user.id,
        changes={k: (v.value if hasattr(v, "value") else v) for k, v in data.items()},
    )
    db.session.commit()
    return user


@blp.route("/patients/<int:patient_id>/doctor", methods=["PUT"])
@admin_only
@blp.arguments(AssignDoctorSchema)
@blp.response(200, PatientSchema)
@blp.doc(security=BEARER)
def assign_doctor(data, patient_id: int):
    """Assign (or unassign with null) the doctor responsible for a patient."""
    patient = db.session.get(Patient, patient_id)
    if patient is None:
        abort(404, message="Patient not found.")
    doctor_id = data["doctor_id"]
    if doctor_id is not None:
        doctor = db.session.get(User, doctor_id)
        if doctor is None or doctor.role != Role.DOCTOR or not doctor.is_active:
            abort(422, message="doctor_id must belong to an active doctor.")
    patient.assigned_doctor_id = doctor_id
    audit("admin.assign_doctor", "patient", patient.id, doctor_id=doctor_id)
    db.session.commit()
    return patient


@blp.route("/audit-logs", methods=["GET"])
@admin_only
@blp.arguments(AuditQuerySchema, location="query")
@blp.response(200, AuditPageSchema)
@blp.doc(security=BEARER)
def audit_logs(query):
    """Security audit trail, newest first."""
    stmt = db.select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if query["user_id"]:
        stmt = stmt.where(AuditLog.user_id == query["user_id"])
    if query["action"]:
        stmt = stmt.where(AuditLog.action.startswith(query["action"]))
    return paginate(stmt, query["page"], query["page_size"])
