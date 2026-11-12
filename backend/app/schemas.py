"""Marshmallow schemas: request validation and response serialisation (and OpenAPI docs)."""

from __future__ import annotations

import re

from marshmallow import (
    Schema,
    ValidationError,
    fields,
    post_load,
    pre_load,
    validate,
    validates,
    validates_schema,
)

from .models import (
    Disease,
    DoctorStatus,
    PredictionStatus,
    ReviewVerdict,
    RiskLevel,
    Role,
    Sex,
)

PASSWORD_RULE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


def enum_field(enum_cls, **kwargs):
    return fields.Enum(enum_cls, by_value=True, **kwargs)


# --------------------------------------------------------------------------------------------
# Auth & users
# --------------------------------------------------------------------------------------------


class PasswordMixin:
    @validates("password")
    def _strong(self, value: str, **_kwargs) -> None:
        if not PASSWORD_RULE.match(value):
            raise ValidationError("Use at least 8 characters including a letter and a number.")


# Doctor verification fields: printable text only (no control characters or markup)
LICENSE_RULE = re.compile(r"^[A-Z0-9][A-Z0-9 ./\-]{1,48}[A-Z0-9]$")
PLAIN_TEXT_RULE = re.compile(r"^[\w .,&()'/\-]+$")


def _clean(value):
    """Trim and collapse internal whitespace, so 'Delhi  Medical Council ' is stored once."""
    return " ".join(value.split()) if isinstance(value, str) else value


def plain_text(min_len: int, max_len: int, **kwargs):
    return fields.String(
        validate=[
            validate.Length(min=min_len, max=max_len),
            validate.Regexp(PLAIN_TEXT_RULE, error="Use letters, numbers and basic punctuation."),
        ],
        **kwargs,
    )


class RegisterSchema(PasswordMixin, Schema):
    """Self-registration. `role` is not a field: unknown fields are rejected (422)."""

    email = fields.Email(required=True, validate=validate.Length(max=255))
    password = fields.String(required=True, load_only=True)
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    account_type = fields.String(
        load_default="patient", validate=validate.OneOf(["patient", "doctor"])
    )
    # Required when account_type == "doctor"; ignored for patients
    license_number = fields.String(
        validate=validate.Regexp(
            LICENSE_RULE,
            error="Use 3-50 letters, numbers, spaces, '.', '/' or '-'.",
        )
    )
    issuing_authority = plain_text(2, 120)
    hospital = plain_text(2, 120, allow_none=True)
    specialty = plain_text(2, 80, allow_none=True)

    @pre_load
    def _normalise(self, data, **_kwargs):
        if not isinstance(data, dict):
            return data
        data = {k: _clean(v) for k, v in data.items()}
        if isinstance(data.get("license_number"), str):
            data["license_number"] = data["license_number"].upper()
        for optional in ("hospital", "specialty"):
            if data.get(optional) == "":
                data[optional] = None
        return data

    @validates_schema
    def _doctor_fields(self, data, **_kwargs):
        if data.get("account_type") != "doctor":
            return
        missing = {
            name: ["Required for doctor accounts."]
            for name in ("license_number", "issuing_authority")
            if not data.get(name)
        }
        if missing:
            raise ValidationError(missing)

    @post_load
    def _drop_doctor_fields_for_patients(self, data, **_kwargs):
        if data["account_type"] != "doctor":
            for name in ("license_number", "issuing_authority", "hospital", "specialty"):
                data.pop(name, None)
        return data


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)


class DoctorApplicationStatusSchema(Schema):
    """What the signed-in applicant sees about their own verification."""

    status = enum_field(DoctorStatus)
    rejection_reason = fields.String(allow_none=True)
    license_number = fields.String()
    issuing_authority = fields.String()
    hospital = fields.String(allow_none=True)
    specialty = fields.String(allow_none=True)
    has_document = fields.Function(lambda d: bool(d.document_path))
    submitted_at = fields.DateTime(attribute="created_at")
    reviewed_at = fields.DateTime(allow_none=True)


class UserSchema(Schema):
    id = fields.Integer(dump_only=True)
    email = fields.Email()
    full_name = fields.String()
    role = enum_field(Role)
    is_active = fields.Boolean()
    created_at = fields.DateTime(dump_only=True)
    last_login_at = fields.DateTime(dump_only=True, allow_none=True)
    patient_id = fields.Function(
        lambda u: u.patient_profile.id if u.patient_profile else None, dump_only=True
    )
    # Present for self-registered doctors; the UI shows a review/rejected screen until approved
    doctor_application = fields.Nested(
        DoctorApplicationStatusSchema, attribute="doctor_profile", dump_only=True, allow_none=True
    )


class TokenSchema(Schema):
    access_token = fields.String(required=True)
    refresh_token = fields.String()
    user = fields.Nested(UserSchema)


class MessageSchema(Schema):
    message = fields.String()


# --------------------------------------------------------------------------------------------
# Patients
# --------------------------------------------------------------------------------------------


class DoctorBriefSchema(Schema):
    id = fields.Integer()
    full_name = fields.String()
    email = fields.Email()


class PatientUpdateSchema(Schema):
    full_name = fields.String(validate=validate.Length(min=2, max=120))
    date_of_birth = fields.Date(allow_none=True)
    sex = enum_field(Sex, allow_none=True)
    phone = fields.String(
        allow_none=True, validate=validate.Regexp(r"^\+?[0-9 \-]{7,20}$", error="Invalid phone.")
    )
    blood_group = fields.String(allow_none=True, validate=validate.OneOf(BLOOD_GROUPS))
    height_cm = fields.Float(allow_none=True, validate=validate.Range(50, 250))
    weight_kg = fields.Float(allow_none=True, validate=validate.Range(2, 300))
    medical_history = fields.String(allow_none=True, validate=validate.Length(max=4000))

    @validates("date_of_birth")
    def _past(self, value, **_kwargs) -> None:
        from datetime import date

        if value and not (date(1900, 1, 1) <= value <= date.today()):
            raise ValidationError("Date of birth must be in the past.")


class PatientSchema(Schema):
    id = fields.Integer()
    user_id = fields.Integer()
    full_name = fields.Function(lambda p: p.user.full_name)
    email = fields.Function(lambda p: p.user.email)
    date_of_birth = fields.Date(allow_none=True)
    age = fields.Integer(allow_none=True)
    sex = enum_field(Sex, allow_none=True)
    phone = fields.String(allow_none=True)
    blood_group = fields.String(allow_none=True)
    height_cm = fields.Float(allow_none=True)
    weight_kg = fields.Float(allow_none=True)
    bmi = fields.Float(allow_none=True)
    medical_history = fields.String(allow_none=True)
    assigned_doctor = fields.Nested(DoctorBriefSchema, allow_none=True)
    prediction_count = fields.Function(lambda p: len(p.predictions))
    created_at = fields.DateTime()


class PatientQuerySchema(Schema):
    search = fields.String(load_default=None)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(1, 100))


# --------------------------------------------------------------------------------------------
# Predictions
# --------------------------------------------------------------------------------------------


class PredictionRequestSchema(Schema):
    patient_id = fields.Integer(
        load_default=None,
        metadata={"description": "Required for doctors; patients always predict for themselves."},
    )
    inputs = fields.Dict(
        required=True,
        metadata={
            "description": "Feature name -> value. For the symptom module: "
            '{"symptoms": ["itching", "skin_rash"]}',
            "example": {"Glucose": 168, "BMI": 33.1, "Age": 47},
        },
    )


class ReviewSchema(Schema):
    id = fields.Integer(dump_only=True)
    verdict = enum_field(ReviewVerdict, required=True)
    notes = fields.String(allow_none=True, validate=validate.Length(max=4000))
    doctor = fields.Nested(DoctorBriefSchema, dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)


class ModelInfoSchema(Schema):
    version = fields.String()
    algorithm = fields.String()


class PredictionSchema(Schema):
    id = fields.Integer()
    patient_id = fields.Integer()
    patient_name = fields.Function(lambda p: p.patient.user.full_name)
    disease = enum_field(Disease)
    input_data = fields.Dict()
    predicted_label = fields.String()
    probability = fields.Float()
    risk_level = enum_field(RiskLevel)
    explanation = fields.Function(lambda p: p.explanation.get("explanation"))
    top_conditions = fields.Function(lambda p: p.explanation.get("top_conditions"))
    guidance = fields.Function(lambda p: p.explanation.get("guidance", []))
    red_flags = fields.Function(lambda p: p.explanation.get("red_flags", []))
    model = fields.Function(
        lambda p: (
            {"version": p.model_version.version, "algorithm": p.model_version.algorithm}
            if p.model_version
            else None
        )
    )
    status = enum_field(PredictionStatus)
    review = fields.Nested(ReviewSchema, allow_none=True)
    report_codes = fields.Function(lambda p: [r.report_code for r in p.reports])
    created_by = fields.Function(lambda p: p.created_by.full_name if p.created_by else None)
    created_at = fields.DateTime()
    disclaimer = fields.Constant(
        "Preliminary decision support only. This is not a medical diagnosis; "
        "consult a qualified healthcare professional."
    )


class PredictionQuerySchema(Schema):
    patient_id = fields.Integer(load_default=None)
    disease = enum_field(Disease, load_default=None)
    risk_level = enum_field(RiskLevel, load_default=None)
    status = enum_field(PredictionStatus, load_default=None)
    date_from = fields.Date(load_default=None)
    date_to = fields.Date(load_default=None)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(1, 100))


# --------------------------------------------------------------------------------------------
# Admin
# --------------------------------------------------------------------------------------------


class AdminUserCreateSchema(PasswordMixin, Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, load_only=True)
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    role = enum_field(Role, required=True)


class AdminUserUpdateSchema(Schema):
    full_name = fields.String(validate=validate.Length(min=2, max=120))
    role = enum_field(Role)
    is_active = fields.Boolean()


class AdminUserQuerySchema(Schema):
    role = enum_field(Role, load_default=None)
    search = fields.String(load_default=None)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(1, 100))


class AssignDoctorSchema(Schema):
    doctor_id = fields.Integer(required=True, allow_none=True)


class DoctorApplicationSchema(Schema):
    id = fields.Integer()
    user = fields.Nested(
        Schema.from_dict(
            {
                "id": fields.Integer(),
                "full_name": fields.String(),
                "email": fields.Email(),
                "is_active": fields.Boolean(),
                "role": enum_field(Role),
            },
            name="ApplicantUser",
        )
    )
    license_number = fields.String()
    issuing_authority = fields.String()
    hospital = fields.String(allow_none=True)
    specialty = fields.String(allow_none=True)
    status = enum_field(DoctorStatus)
    rejection_reason = fields.String(allow_none=True)
    has_document = fields.Function(lambda d: bool(d.document_path))
    reviewed_by = fields.Nested(DoctorBriefSchema, allow_none=True)
    reviewed_at = fields.DateTime(allow_none=True)
    created_at = fields.DateTime()


class DoctorApplicationQuerySchema(Schema):
    status = enum_field(DoctorStatus, load_default=None)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(1, 100))


class RejectApplicationSchema(Schema):
    reason = fields.String(required=True, validate=validate.Length(min=5, max=500))

    @pre_load
    def _trim(self, data, **_kwargs):
        if isinstance(data, dict) and isinstance(data.get("reason"), str):
            data = {**data, "reason": data["reason"].strip()}
        return data


class AuditLogSchema(Schema):
    id = fields.Integer()
    user_id = fields.Integer(allow_none=True)
    user_email = fields.Function(lambda a: a.user.email if a.user else None)
    action = fields.String()
    entity_type = fields.String(allow_none=True)
    entity_id = fields.Integer(allow_none=True)
    ip_address = fields.String(allow_none=True)
    details = fields.Dict(allow_none=True)
    created_at = fields.DateTime()


class AuditQuerySchema(Schema):
    user_id = fields.Integer(load_default=None)
    action = fields.String(load_default=None)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=50, validate=validate.Range(1, 200))


# --------------------------------------------------------------------------------------------
# Paginated envelopes
# --------------------------------------------------------------------------------------------


def page_schema(item_schema: type[Schema], name: str) -> type[Schema]:
    return Schema.from_dict(
        {
            "items": fields.List(fields.Nested(item_schema)),
            "total": fields.Integer(),
            "page": fields.Integer(),
            "page_size": fields.Integer(),
            "pages": fields.Integer(),
        },
        name=name,
    )


PatientPageSchema = page_schema(PatientSchema, "PatientPage")
PredictionPageSchema = page_schema(PredictionSchema, "PredictionPage")
UserPageSchema = page_schema(UserSchema, "UserPage")
AuditPageSchema = page_schema(AuditLogSchema, "AuditLogPage")
DoctorApplicationPageSchema = page_schema(DoctorApplicationSchema, "DoctorApplicationPage")
