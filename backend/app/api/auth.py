"""Registration, login, token refresh, logout and current-user endpoints."""

from datetime import UTC, datetime

from flask import current_app, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    current_user,
    get_jwt,
    jwt_required,
)
from flask_smorest import Blueprint, abort
from sqlalchemy import func

from ..extensions import db, limiter
from ..models import DoctorProfile, DoctorStatus, Patient, Role, User
from ..schemas import LoginSchema, MessageSchema, RegisterSchema, TokenSchema, UserSchema
from ..security import BEARER, account_required, audit, revoke
from ..services.assignment import auto_assign
from ..services.doctor_documents import DocumentError, delete_document, save_document

blp = Blueprint("auth", __name__, url_prefix="/auth", description="Authentication")


def _tokens(user: User) -> dict:
    return {
        "access_token": create_access_token(identity=user),
        "refresh_token": create_refresh_token(identity=user),
        "user": user,
    }


def _login_limit() -> str:
    return current_app.config["LOGIN_RATE_LIMIT"]


def _register_limit() -> str:
    return current_app.config["REGISTER_RATE_LIMIT"]


@blp.route("/register", methods=["POST"])
@limiter.limit(_register_limit)
@blp.arguments(RegisterSchema)
@blp.response(201, TokenSchema)
def register(data):
    """Create an account and sign in.

    `account_type: "patient"` (default) creates a patient with an empty profile, assigned to
    the least-loaded doctor. `account_type: "doctor"` creates an applicant awaiting manual
    verification by an admin: it has no clinical access until approved. The role can never be
    chosen by the client.
    """
    email = data["email"].strip().lower()
    if db.session.scalar(db.select(User.id).filter_by(email=email)):
        abort(409, message="An account with this email already exists.")
    is_doctor = data["account_type"] == "doctor"
    if is_doctor and _license_taken(data["issuing_authority"], data["license_number"]):
        abort(
            409,
            message="This licence number is already registered with this authority.",
            errors={"json": {"license_number": ["Already registered."]}},
        )
    # Applicants stay role=patient (without a patient profile) until an admin approves them
    user = User(email=email, full_name=data["full_name"].strip(), role=Role.PATIENT)
    user.set_password(data["password"])
    db.session.add(user)
    details: dict = {"account_type": data["account_type"]}
    if is_doctor:
        db.session.add(
            DoctorProfile(
                user=user,
                license_number=data["license_number"],
                issuing_authority=data["issuing_authority"],
                hospital=data.get("hospital"),
                specialty=data.get("specialty"),
                status=DoctorStatus.PENDING,
            )
        )
    else:
        patient = Patient(user=user)
        db.session.add(patient)
        doctor = auto_assign(patient)
        details["assigned_doctor_id"] = doctor.id if doctor else None
    db.session.flush()
    audit("auth.register", "user", user.id, user_id=user.id, **details)
    db.session.commit()
    return _tokens(user)


def _license_taken(authority: str, license_number: str) -> bool:
    """Case-insensitive duplicate check (the DB unique constraint is the final guard)."""
    stmt = db.select(DoctorProfile.id).where(
        func.lower(DoctorProfile.issuing_authority) == authority.lower(),
        func.upper(DoctorProfile.license_number) == license_number.upper(),
    )
    return db.session.scalar(stmt) is not None


@blp.route("/login", methods=["POST"])
@limiter.limit(_login_limit)
@blp.arguments(LoginSchema)
@blp.response(200, TokenSchema)
def login(data):
    """Exchange email + password for an access token (30 min) and refresh token (7 days)."""
    email = data["email"].strip().lower()
    user = db.session.scalar(db.select(User).filter_by(email=email))
    if user is None or not user.check_password(data["password"]):
        audit("auth.login_failed", email=email)
        db.session.commit()
        abort(401, message="Invalid email or password.")
    if not user.is_active:
        abort(403, message="This account has been deactivated. Contact the administrator.")
    user.last_login_at = datetime.now(UTC)
    audit("auth.login", "user", user.id, user_id=user.id)
    db.session.commit()
    return _tokens(user)


@blp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
@blp.response(200, TokenSchema)
@blp.doc(security=BEARER)
def refresh():
    """Get a new access token using a refresh token (send the refresh token as Bearer)."""
    return {"access_token": create_access_token(identity=current_user), "user": current_user}


@blp.route("/logout", methods=["POST"])
@jwt_required(verify_type=False)
@blp.response(200, MessageSchema)
@blp.doc(security=BEARER)
def logout():
    """Revoke the token used for this request (call once with each token to revoke both)."""
    revoke(get_jwt())
    audit("auth.logout", "user", current_user.id)
    db.session.commit()
    return {"message": "Signed out."}


@blp.route("/me", methods=["GET"])
@account_required
@blp.response(200, UserSchema)
@blp.doc(security=BEARER)
def me():
    """The signed-in user (doctor applicants: includes `doctor_application` status)."""
    return current_user


@blp.route("/doctor-application/document", methods=["POST"])
@limiter.limit(_register_limit)
@account_required
@blp.response(200, UserSchema)
@blp.alt_response(422, description="Not a PDF/JPG/PNG, or larger than 5 MB")
@blp.doc(
    security=BEARER,
    requestBody={
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "properties": {"document": {"type": "string", "format": "binary"}},
                }
            }
        }
    },
)
def upload_doctor_document():
    """Attach proof of registration (PDF, JPG or PNG, max 5 MB) to a pending application."""
    application = current_user.doctor_profile
    if application is None or application.status != DoctorStatus.PENDING:
        abort(403, message="Only pending doctor applications can upload documents.")
    upload = request.files.get("document")
    if upload is None:
        abort(422, message="Choose a file.", errors={"files": {"document": ["Required."]}})
    try:
        name = save_document(upload)
    except DocumentError as exc:
        abort(422, message=str(exc), errors={"files": {"document": [str(exc)]}})
    previous = application.document_path
    application.document_path = name
    audit("auth.doctor_document_upload", "doctor_application", application.id)
    db.session.commit()
    delete_document(previous)
    return current_user
