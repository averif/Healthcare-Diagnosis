"""Administration: users and roles, doctor verification, doctor assignment, audit log."""

from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO

from flask import send_file
from flask_jwt_extended import current_user
from flask_smorest import Blueprint, abort
from sqlalchemy import or_

from ..extensions import db
from ..models import AuditLog, DoctorProfile, DoctorStatus, Patient, Role, User
from ..pagination import paginate
from ..schemas import (
    AdminUserCreateSchema,
    AdminUserQuerySchema,
    AdminUserUpdateSchema,
    AssignDoctorSchema,
    AuditPageSchema,
    AuditQuerySchema,
    DoctorApplicationPageSchema,
    DoctorApplicationQuerySchema,
    DoctorApplicationSchema,
    PatientSchema,
    RejectApplicationSchema,
    UserPageSchema,
    UserSchema,
)
from ..security import BEARER, audit, roles_required
from ..services.assignment import reassign_patients_of
from ..services.doctor_documents import document_file

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
    if user.is_doctor_applicant and data.get("role", user.role) != user.role:
        abort(409, message="Approve or reject this doctor application instead of changing roles.")
    was_active_doctor = user.role == Role.DOCTOR and user.is_active
    for field, value in data.items():
        setattr(user, field, value)
    if user.role == Role.PATIENT and user.patient_profile is None and not user.is_doctor_applicant:
        db.session.add(Patient(user=user))
    extra = {}
    if was_active_doctor and not (user.role == Role.DOCTOR and user.is_active):
        # The doctor can no longer see their patients: hand them to the least-loaded doctors
        extra["reassigned_patients"] = reassign_patients_of(user)
    audit(
        "admin.user_update",
        "user",
        user.id,
        changes={k: (v.value if hasattr(v, "value") else v) for k, v in data.items()},
        **extra,
    )
    db.session.commit()
    return user


# --------------------------------------------------------------------------------------------
# Doctor verification
# --------------------------------------------------------------------------------------------


def _application_or_404(application_id: int) -> DoctorProfile:
    application = db.session.get(DoctorProfile, application_id)
    if application is None:
        abort(404, message="Application not found.")
    return application


@blp.route("/doctor-applications", methods=["GET"])
@admin_only
@blp.arguments(DoctorApplicationQuerySchema, location="query")
@blp.response(200, DoctorApplicationPageSchema)
@blp.doc(security=BEARER)
def list_doctor_applications(query):
    """Doctor sign-ups, oldest first, filterable by status (pending / approved / rejected)."""
    stmt = db.select(DoctorProfile).order_by(DoctorProfile.created_at, DoctorProfile.id)
    if query["status"]:
        stmt = stmt.where(DoctorProfile.status == query["status"])
    return paginate(stmt, query["page"], query["page_size"])


@blp.route("/doctor-applications/<int:application_id>", methods=["GET"])
@admin_only
@blp.response(200, DoctorApplicationSchema)
@blp.doc(security=BEARER)
def get_doctor_application(application_id: int):
    """One doctor application."""
    return _application_or_404(application_id)


@blp.route("/doctor-applications/<int:application_id>/approve", methods=["POST"])
@admin_only
@blp.response(200, DoctorApplicationSchema)
@blp.doc(security=BEARER)
def approve_doctor_application(application_id: int):
    """Verify the licence: the account becomes a doctor with clinical access."""
    application = _application_or_404(application_id)
    if application.status == DoctorStatus.APPROVED:
        abort(409, message="This application is already approved.")
    application.status = DoctorStatus.APPROVED
    application.rejection_reason = None
    application.reviewed_by_id = current_user.id
    application.reviewed_at = datetime.now(UTC)
    application.user.role = Role.DOCTOR
    audit(
        "admin.doctor_approve",
        "doctor_application",
        application.id,
        doctor_user_id=application.user_id,
        license_number=application.license_number,
        issuing_authority=application.issuing_authority,
    )
    db.session.commit()
    return application


@blp.route("/doctor-applications/<int:application_id>/reject", methods=["POST"])
@admin_only
@blp.arguments(RejectApplicationSchema)
@blp.response(200, DoctorApplicationSchema)
@blp.doc(security=BEARER)
def reject_doctor_application(data, application_id: int):
    """Refuse a pending application with a reason the applicant will see."""
    application = _application_or_404(application_id)
    if application.status != DoctorStatus.PENDING:
        abort(409, message="Only pending applications can be rejected.")
    application.status = DoctorStatus.REJECTED
    application.rejection_reason = data["reason"]
    application.reviewed_by_id = current_user.id
    application.reviewed_at = datetime.now(UTC)
    audit(
        "admin.doctor_reject",
        "doctor_application",
        application.id,
        doctor_user_id=application.user_id,
        reason=data["reason"],
    )
    db.session.commit()
    return application


@blp.route("/doctor-applications/<int:application_id>/document", methods=["GET"])
@admin_only
@blp.response(200, description="The uploaded file (PDF, JPG or PNG)")
@blp.doc(security=BEARER)
def download_doctor_document(application_id: int):
    """Download the applicant's proof of registration."""
    application = _application_or_404(application_id)
    found = document_file(application.document_path)
    if found is None:
        abort(404, message="No document uploaded for this application.")
    path, mimetype = found
    audit("admin.doctor_document_view", "doctor_application", application.id)
    db.session.commit()
    response = send_file(
        BytesIO(path.read_bytes()),
        mimetype=mimetype,
        as_attachment=True,
        download_name=f"doctor-application-{application.id}{path.suffix}",
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


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
