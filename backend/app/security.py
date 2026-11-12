"""Authentication, role-based access control and audit logging helpers."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import suppress
from datetime import UTC, datetime
from functools import wraps
from typing import Any

from flask import Flask, request
from flask_jwt_extended import current_user, verify_jwt_in_request
from flask_smorest import abort

from .extensions import db, jwt
from .models import AuditLog, Patient, Prediction, RevokedToken, Role, User


def error_body(code: int, status: str, message: str) -> dict:
    return {"code": code, "status": status, "message": message}


def init_jwt(app: Flask) -> None:
    """Wire Flask-JWT-Extended to our User model and the revoked-token table."""

    @jwt.user_identity_loader
    def _identity(user: User) -> str:
        return str(user.id)

    @jwt.additional_claims_loader
    def _claims(user: User) -> dict:
        return {"role": user.role.value, "name": user.full_name}

    @jwt.user_lookup_loader
    def _lookup(_header: dict, payload: dict) -> User | None:
        user = db.session.get(User, int(payload["sub"]))
        return user if user and user.is_active else None  # deactivated users are locked out

    @jwt.token_in_blocklist_loader
    def _revoked(_header: dict, payload: dict) -> bool:
        stmt = db.select(RevokedToken.id).filter_by(jti=payload["jti"])
        return db.session.scalar(stmt) is not None

    # Consistent JSON error shape for every auth failure
    def unauthorized(message: str):
        return error_body(401, "Unauthorized", message), 401

    jwt.unauthorized_loader(lambda reason: unauthorized("Missing or invalid Authorization header."))
    jwt.invalid_token_loader(lambda reason: unauthorized("Invalid token."))
    jwt.expired_token_loader(lambda h, p: unauthorized("Token has expired."))
    jwt.revoked_token_loader(lambda h, p: unauthorized("Token has been revoked."))
    jwt.user_lookup_error_loader(lambda h, p: unauthorized("Account not found or deactivated."))
    jwt.needs_fresh_token_loader(lambda h, p: unauthorized("Fresh token required."))


def revoke(payload: dict) -> None:
    db.session.add(
        RevokedToken(
            jti=payload["jti"],
            token_type=payload["type"],
            user_id=int(payload["sub"]),
            expires_at=datetime.fromtimestamp(payload["exp"], UTC),
        )
    )


def roles_required(*roles: Role, allow_applicants: bool = False) -> Callable:
    """Require a valid access token and one of the given roles (any role if none given).

    Doctor applicants (pending or rejected verification) are refused everywhere unless
    allow_applicants=True, so an unapproved sign-up can only see its own account status.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any):
            verify_jwt_in_request()
            if roles and current_user.role not in roles:
                abort(403, message="You do not have permission to perform this action.")
            if current_user.is_doctor_applicant and not allow_applicants:
                abort(403, message="Your doctor account has not been approved by an administrator.")
            return fn(*args, **kwargs)

        return wrapper

    return decorator


login_required = roles_required()
#: Any signed-in account, including doctor applicants awaiting verification
account_required = roles_required(allow_applicants=True)

#: Attach to flask-smorest docs so Swagger shows the padlock on protected endpoints
BEARER = [{"bearerAuth": []}]


def audit(action: str, entity_type: str | None = None, entity_id: int | None = None, **details):
    """Record a security-relevant action. Committed together with the caller's transaction."""
    user_id = None
    with suppress(RuntimeError):  # no JWT in this request (e.g. failed login)
        user_id = current_user.id if current_user else None
    db.session.add(
        AuditLog(
            user_id=details.pop("user_id", user_id),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=request.remote_addr,
            details=details or None,
        )
    )


# --------------------------------------------------------------------------------------------
# Record-level access rules
# --------------------------------------------------------------------------------------------


def can_access_patient(user: User, patient: Patient) -> bool:
    if user.role == Role.ADMIN:
        return True
    if user.role == Role.DOCTOR:
        return patient.assigned_doctor_id == user.id
    return patient.user_id == user.id


def get_patient_or_404(patient_id: int) -> Patient:
    patient = db.session.get(Patient, patient_id)
    if patient is None or not can_access_patient(current_user, patient):
        # 404 (not 403) so users cannot probe which patient IDs exist
        abort(404, message="Patient not found.")
    return patient


def get_prediction_or_404(prediction_id: int) -> Prediction:
    prediction = db.session.get(Prediction, prediction_id)
    if prediction is None or not can_access_patient(current_user, prediction.patient):
        abort(404, message="Prediction not found.")
    return prediction


def own_patient_profile() -> Patient:
    patient = current_user.patient_profile
    if patient is None:
        abort(404, message="No patient profile for this account.")
    return patient


def visible_patient_ids_query():
    """SELECT of patient IDs the current user may see (for list endpoints)."""
    stmt = db.select(Patient.id)
    if current_user.role == Role.DOCTOR:
        stmt = stmt.where(Patient.assigned_doctor_id == current_user.id)
    elif current_user.role == Role.PATIENT:
        stmt = stmt.where(Patient.user_id == current_user.id)
    return stmt
