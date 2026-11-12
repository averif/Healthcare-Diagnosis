"""Run explained predictions, browse history, record doctor reviews and export PDF reports."""

from __future__ import annotations

from datetime import datetime, time
from io import BytesIO

from flask import current_app, send_file
from flask_jwt_extended import current_user
from flask_smorest import Blueprint, abort

from ..extensions import db
from ..models import (
    Disease,
    DoctorReview,
    Patient,
    Prediction,
    PredictionStatus,
    Report,
    Role,
)
from ..pagination import paginate
from ..schemas import (
    PredictionPageSchema,
    PredictionQuerySchema,
    PredictionRequestSchema,
    PredictionSchema,
    ReviewSchema,
)
from ..security import (
    BEARER,
    audit,
    get_patient_or_404,
    get_prediction_or_404,
    login_required,
    own_patient_profile,
    roles_required,
    visible_patient_ids_query,
)
from ..services.assignment import auto_assign
from ..services.predictor import InputError, prediction_service
from ..services.reports import build_pdf

blp = Blueprint(
    "predictions", __name__, url_prefix="/predictions", description="Explained predictions"
)
reports_blp = Blueprint("reports", __name__, url_prefix="/reports", description="PDF reports")


def _disease(value: str) -> Disease:
    try:
        return Disease(value)
    except ValueError:
        abort(404, message=f"Unknown module '{value}'.")


# --------------------------------------------------------------------------------------------
# Module catalogue
# --------------------------------------------------------------------------------------------


@blp.route("/modules", methods=["GET"])
@login_required
@blp.doc(security=BEARER)
def list_modules():
    """Available prediction modules with input fields, valid ranges and model metrics.

    The frontend builds its forms from this, so validation rules live in one place.
    """
    return prediction_service().modules()


@blp.route("/modules/<disease>", methods=["GET"])
@login_required
@blp.doc(security=BEARER)
def get_module(disease: str):
    """One module's input schema (for the symptom module: the list of symptoms)."""
    return prediction_service().module(_disease(disease))


# --------------------------------------------------------------------------------------------
# Run a prediction
# --------------------------------------------------------------------------------------------


def _target_patient(patient_id: int | None) -> Patient:
    if current_user.role == Role.PATIENT:
        patient = own_patient_profile()
        if patient_id not in (None, patient.id):
            abort(403, message="Patients can only run predictions for themselves.")
        return patient
    if patient_id is None:
        abort(
            422, message="patient_id is required.", errors={"json": {"patient_id": ["Required."]}}
        )
    return get_patient_or_404(patient_id)


@blp.route("/<disease>", methods=["POST"])
@roles_required(Role.PATIENT, Role.DOCTOR)
@blp.arguments(PredictionRequestSchema)
@blp.response(201, PredictionSchema)
@blp.alt_response(422, description="Inputs missing or outside clinically plausible ranges")
@blp.doc(security=BEARER)
def create_prediction(body, disease: str):
    """Run a model and store the explained result (status: pending review)."""
    module = _disease(disease)
    patient = _target_patient(body["patient_id"])
    if patient.assigned_doctor_id is None:
        # Fallback for patients who registered while no approved doctor was available
        doctor = auto_assign(patient)
        if doctor is not None:
            audit("patient.auto_assign", "patient", patient.id, doctor_id=doctor.id)
    try:
        prediction = prediction_service().create(module, patient, body["inputs"], current_user)
    except InputError as exc:
        abort(422, message="Some inputs are invalid.", errors={"json": {"inputs": exc.errors}})
    audit(
        "prediction.create",
        "prediction",
        prediction.id,
        disease=module.value,
        risk=prediction.risk_level.value,
        patient_id=patient.id,
    )
    db.session.commit()
    return prediction


# --------------------------------------------------------------------------------------------
# History
# --------------------------------------------------------------------------------------------


@blp.route("", methods=["GET"])
@login_required
@blp.arguments(PredictionQuerySchema, location="query")
@blp.response(200, PredictionPageSchema)
@blp.doc(security=BEARER)
def list_predictions(query):
    """Prediction history visible to the caller, newest first, with filters."""
    stmt = (
        db.select(Prediction)
        .where(Prediction.patient_id.in_(visible_patient_ids_query()))
        .order_by(Prediction.created_at.desc(), Prediction.id.desc())
    )
    if query["patient_id"]:
        stmt = stmt.where(Prediction.patient_id == query["patient_id"])
    for field in ("disease", "risk_level", "status"):
        if query[field]:
            stmt = stmt.where(getattr(Prediction, field) == query[field])
    if query["date_from"]:
        stmt = stmt.where(Prediction.created_at >= datetime.combine(query["date_from"], time.min))
    if query["date_to"]:
        stmt = stmt.where(Prediction.created_at <= datetime.combine(query["date_to"], time.max))
    return paginate(stmt, query["page"], query["page_size"])


@blp.route("/<int:prediction_id>", methods=["GET"])
@login_required
@blp.response(200, PredictionSchema)
@blp.doc(security=BEARER)
def get_prediction(prediction_id: int):
    """One prediction with its explanation, guidance and doctor review."""
    prediction = get_prediction_or_404(prediction_id)
    if current_user.role != Role.PATIENT:
        audit("prediction.view", "prediction", prediction.id)
        db.session.commit()
    return prediction


# --------------------------------------------------------------------------------------------
# Doctor review (human in the loop)
# --------------------------------------------------------------------------------------------


@blp.route("/<int:prediction_id>/review", methods=["PUT"])
@roles_required(Role.DOCTOR)
@blp.arguments(ReviewSchema)
@blp.response(200, PredictionSchema)
@blp.doc(security=BEARER)
def review_prediction(data, prediction_id: int):
    """Record (or update) the assigned doctor's verdict and notes on a prediction."""
    prediction = get_prediction_or_404(prediction_id)
    review = prediction.review or DoctorReview(prediction=prediction)
    review.doctor = current_user
    review.verdict = data["verdict"]
    review.notes = (data.get("notes") or "").strip() or None
    prediction.status = PredictionStatus.REVIEWED
    db.session.add(review)
    audit("review.save", "prediction", prediction.id, verdict=review.verdict.value)
    db.session.commit()
    return prediction


# --------------------------------------------------------------------------------------------
# PDF reports
# --------------------------------------------------------------------------------------------


def _feature_specs(prediction: Prediction) -> list[dict]:
    module = prediction_service().module(prediction.disease)
    return module["features"]


def _send(report: Report, prediction: Prediction):
    path = current_app.config["REPORTS_DIR"] / f"{report.report_code}.pdf"
    if not path.exists():  # rebuild if the file was cleaned up
        build_pdf(prediction, report, path, _feature_specs(prediction))
    # Serve from memory: reports are small and this avoids holding a file lock on Windows
    response = send_file(
        BytesIO(path.read_bytes()),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"MediAssist-{report.report_code}.pdf",
    )
    response.headers["X-Report-Code"] = report.report_code
    return response


@blp.route("/<int:prediction_id>/report", methods=["POST"])
@login_required
@blp.response(200, description="The PDF file", content_type="application/pdf")
@blp.doc(security=BEARER)
def create_report(prediction_id: int):
    """Generate a PDF report (with a unique report code) and download it."""
    prediction = get_prediction_or_404(prediction_id)
    report = Report(prediction=prediction, generated_by=current_user, file_path="")
    db.session.add(report)
    db.session.flush()
    path = current_app.config["REPORTS_DIR"] / f"{report.report_code}.pdf"
    build_pdf(prediction, report, path, _feature_specs(prediction))
    report.file_path = path.name
    audit("report.generate", "report", report.id, code=report.report_code)
    db.session.commit()
    return _send(report, prediction)


@reports_blp.route("/<code>", methods=["GET"])
@login_required
@reports_blp.response(200, description="The PDF file", content_type="application/pdf")
@reports_blp.doc(security=BEARER)
def download_report(code: str):
    """Download a previously generated report by its code (e.g. RPT-7F3K9Q2M)."""
    report = db.session.scalar(db.select(Report).filter_by(report_code=code.upper()))
    if report is None:
        abort(404, message="Report not found.")
    prediction = get_prediction_or_404(report.prediction_id)
    audit("report.download", "report", report.id, code=report.report_code)
    db.session.commit()
    return _send(report, prediction)
