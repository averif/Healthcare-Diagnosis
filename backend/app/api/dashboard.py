"""Dashboard statistics and the model performance (model card) endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from flask_jwt_extended import current_user
from flask_smorest import Blueprint
from sqlalchemy import func

from ..extensions import db
from ..models import (
    Disease,
    ModelVersion,
    Patient,
    Prediction,
    PredictionStatus,
    RiskLevel,
    Role,
    User,
)
from ..schemas import PredictionSchema
from ..security import BEARER, login_required, roles_required, visible_patient_ids_query
from ..services.predictor import prediction_service

blp = Blueprint("dashboard", __name__, url_prefix="/dashboard", description="Dashboards")
models_blp = Blueprint("models", __name__, url_prefix="/models", description="Model performance")


def _counts(column, scope) -> dict[str, int]:
    rows = db.session.execute(
        db.select(column, func.count()).where(Prediction.patient_id.in_(scope)).group_by(column)
    ).all()
    return {(k.value if hasattr(k, "value") else str(k)): n for k, n in rows}


@blp.route("/summary", methods=["GET"])
@login_required
@blp.doc(security=BEARER)
def summary():
    """Headline numbers and chart data, scoped to what the caller may see.

    Patients see their own history, doctors their assigned patients, admins everything.
    """
    scope = visible_patient_ids_query()
    in_scope = Prediction.patient_id.in_(scope)
    since = datetime.now(UTC) - timedelta(days=29)

    per_day_rows = db.session.execute(
        db.select(func.date(Prediction.created_at), func.count())
        .where(in_scope, Prediction.created_at >= since.replace(tzinfo=None))
        .group_by(func.date(Prediction.created_at))
    ).all()
    per_day = {str(day): n for day, n in per_day_rows}  # SQLite returns str, MySQL a date
    today = datetime.now(UTC).date()  # stored timestamps are UTC, so bucket days in UTC
    timeline = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        timeline.append({"date": day.isoformat(), "count": per_day.get(day.isoformat(), 0)})

    recent = db.session.scalars(
        db.select(Prediction).where(in_scope).order_by(Prediction.created_at.desc()).limit(5)
    ).all()

    count = lambda *conds: db.session.scalar(  # noqa: E731
        db.select(func.count(Prediction.id)).where(in_scope, *conds)
    )
    result = {
        "totals": {
            "patients": db.session.scalar(db.select(func.count()).select_from(scope.subquery())),
            "predictions": count(),
            "pending_reviews": count(Prediction.status == PredictionStatus.PENDING_REVIEW),
            "high_risk": count(Prediction.risk_level == RiskLevel.HIGH),
        },
        "by_disease": {d.value: 0 for d in Disease} | _counts(Prediction.disease, scope),
        "by_risk": {"low": 0, "moderate": 0, "high": 0} | _counts(Prediction.risk_level, scope),
        "by_status": _counts(Prediction.status, scope),
        "timeline": timeline,
        "recent": PredictionSchema(many=True).dump(recent),
    }
    if current_user.role == Role.ADMIN:
        roles = db.session.execute(db.select(User.role, func.count()).group_by(User.role)).all()
        result["users_by_role"] = {r.value: n for r, n in roles}
        result["unassigned_patients"] = db.session.scalar(
            db.select(func.count(Patient.id)).where(Patient.assigned_doctor_id.is_(None))
        )
    return result


@models_blp.route("", methods=["GET"])
@roles_required(Role.DOCTOR, Role.ADMIN)
@models_blp.doc(security=BEARER)
def list_models():
    """Full model cards (metrics, ROC curve, confusion matrix, feature importance, comparison)."""
    service = prediction_service()
    cards = []
    for disease in Disease:
        card = dict(service.bundle(disease).card)
        usage = db.session.scalar(
            db.select(func.count(Prediction.id))
            .join(ModelVersion, Prediction.model_version_id == ModelVersion.id)
            .where(ModelVersion.disease == disease)
        )
        card["predictions_served"] = usage or 0
        cards.append(card)
    return cards
