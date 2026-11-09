"""Registration, login, token refresh, logout and current-user endpoints."""

from datetime import UTC, datetime

from flask import current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    current_user,
    get_jwt,
    jwt_required,
)
from flask_smorest import Blueprint, abort

from ..extensions import db, limiter
from ..models import Patient, Role, User
from ..schemas import LoginSchema, MessageSchema, RegisterSchema, TokenSchema, UserSchema
from ..security import BEARER, audit, login_required, revoke

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
    """Create a patient account (and an empty patient profile) and sign in."""
    email = data["email"].strip().lower()
    if db.session.scalar(db.select(User.id).filter_by(email=email)):
        abort(409, message="An account with this email already exists.")
    user = User(email=email, full_name=data["full_name"].strip(), role=Role.PATIENT)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.add(Patient(user=user))
    db.session.flush()
    audit("auth.register", "user", user.id, user_id=user.id)
    db.session.commit()
    return _tokens(user)


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
@login_required
@blp.response(200, UserSchema)
@blp.doc(security=BEARER)
def me():
    """The signed-in user."""
    return current_user
