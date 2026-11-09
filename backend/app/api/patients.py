"""Patient profiles: own profile for patients; assigned patients for doctors; all for admins."""

from flask_jwt_extended import current_user
from flask_smorest import Blueprint
from sqlalchemy import or_

from ..extensions import db
from ..models import Patient, Role, User
from ..pagination import paginate
from ..schemas import PatientPageSchema, PatientQuerySchema, PatientSchema, PatientUpdateSchema
from ..security import (
    BEARER,
    audit,
    get_patient_or_404,
    own_patient_profile,
    roles_required,
    visible_patient_ids_query,
)

blp = Blueprint("patients", __name__, url_prefix="/patients", description="Patient profiles")


@blp.route("/me", methods=["GET"])
@roles_required(Role.PATIENT)
@blp.response(200, PatientSchema)
@blp.doc(security=BEARER)
def get_my_profile():
    """The signed-in patient's own profile."""
    return own_patient_profile()


@blp.route("/me", methods=["PUT"])
@roles_required(Role.PATIENT)
@blp.arguments(PatientUpdateSchema)
@blp.response(200, PatientSchema)
@blp.doc(security=BEARER)
def update_my_profile(data):
    """Update the signed-in patient's profile (partial updates allowed)."""
    patient = own_patient_profile()
    if "full_name" in data:
        current_user.full_name = data.pop("full_name").strip()
    for field, value in data.items():
        setattr(patient, field, value)
    audit("patient.update", "patient", patient.id, fields=sorted(data))
    db.session.commit()
    return patient


@blp.route("", methods=["GET"])
@roles_required(Role.DOCTOR, Role.ADMIN)
@blp.arguments(PatientQuerySchema, location="query")
@blp.response(200, PatientPageSchema)
@blp.doc(security=BEARER)
def list_patients(query):
    """Patients visible to the caller: doctors see their assigned patients, admins see all."""
    stmt = (
        db.select(Patient)
        .join(Patient.user)
        .where(Patient.id.in_(visible_patient_ids_query()))
        .order_by(User.full_name)
    )
    if query["search"]:
        term = f"%{query['search'].strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
    return paginate(stmt, query["page"], query["page_size"])


@blp.route("/<int:patient_id>", methods=["GET"])
@roles_required(Role.DOCTOR, Role.ADMIN, Role.PATIENT)
@blp.response(200, PatientSchema)
@blp.doc(security=BEARER)
def get_patient(patient_id):
    """One patient's profile. Access by clinicians is recorded in the audit log."""
    patient = get_patient_or_404(patient_id)
    if current_user.role != Role.PATIENT:
        audit("patient.view", "patient", patient.id)
        db.session.commit()
    return patient
