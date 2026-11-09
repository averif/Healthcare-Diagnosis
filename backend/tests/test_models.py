from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError, StatementError

from app.models import (
    Disease,
    DoctorReview,
    Patient,
    Prediction,
    PredictionStatus,
    Report,
    ReviewVerdict,
    RiskLevel,
    Role,
    User,
)


def make_user(db, email="p@example.test", role=Role.PATIENT):
    user = User(email=email, full_name="Test User", role=role)
    user.set_password("s3cret-pass")
    db.session.add(user)
    db.session.flush()
    return user


def test_password_is_hashed_and_verifiable(db):
    user = make_user(db)
    assert user.password_hash != "s3cret-pass"
    assert user.password_hash.startswith("$argon2")
    assert user.check_password("s3cret-pass")
    assert not user.check_password("wrong")


def test_email_must_be_unique(db):
    make_user(db, email="dup@example.test")
    with pytest.raises(IntegrityError):
        make_user(db, email="dup@example.test")


def test_invalid_enum_value_is_rejected(db):
    user = User(email="x@example.test", full_name="X", password_hash="h", role="superuser")
    db.session.add(user)
    with pytest.raises(StatementError):
        db.session.flush()


def test_patient_derived_age_and_bmi(db):
    patient = Patient(user=make_user(db), height_cm=170, weight_kg=72.25)
    patient.date_of_birth = date(date.today().year - 30, 1, 1)
    assert patient.bmi == 25.0
    assert patient.age in (29, 30)


def test_full_prediction_workflow_relationships(db):
    doctor = make_user(db, email="doc@example.test", role=Role.DOCTOR)
    patient = Patient(user=make_user(db), assigned_doctor=doctor)
    db.session.add(patient)
    db.session.flush()

    prediction = Prediction(
        patient=patient,
        disease=Disease.DIABETES,
        input_data={"glucose": 168, "bmi": 33.1},
        predicted_label="Diabetic",
        probability=0.82,
        risk_level=RiskLevel.HIGH,
        explanation={"path": ["glucose > 140", "bmi > 31.5"]},
    )
    db.session.add(prediction)
    db.session.flush()
    assert prediction.status == PredictionStatus.PENDING_REVIEW

    prediction.review = DoctorReview(doctor=doctor, verdict=ReviewVerdict.AGREE, notes="HbA1c next")
    prediction.reports.append(Report(file_path="reports/x.pdf"))
    db.session.commit()

    stored = db.session.get(Prediction, prediction.id)
    assert stored.review.verdict == ReviewVerdict.AGREE
    assert stored.reports[0].report_code.startswith("RPT-")
    assert patient.predictions == [stored]
