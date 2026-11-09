"""Custom `flask` CLI commands.

flask seed            demo admin, doctor and patient accounts
flask seed --demo     ...plus extra patients and ~60 realistic predictions for the dashboards
"""

from __future__ import annotations

import os
import random
from datetime import UTC, date, datetime, timedelta

import click
from flask import Flask, current_app

from .extensions import db
from .models import (
    Disease,
    DoctorReview,
    Patient,
    Prediction,
    PredictionStatus,
    ReviewVerdict,
    Role,
    Sex,
    User,
)

# Local demo accounts only. Override the password with DEMO_PASSWORD in .env.
DEMO_USERS = [
    ("admin@mediassist.test", "System Admin", Role.ADMIN),
    ("doctor@mediassist.test", "Dr. Saman Verma", Role.DOCTOR),
    ("doctor2@mediassist.test", "Dr. Rahul Mehta", Role.DOCTOR),
    ("patient@mediassist.test", "Aarav Sharma", Role.PATIENT),
]

DEMO_PATIENTS = [
    ("Priya Singh", Sex.FEMALE, date(1975, 2, 3), 160, 72),
    ("Mohammed Faiz", Sex.MALE, date(1962, 11, 21), 175, 88),
    ("Ananya Gupta", Sex.FEMALE, date(1990, 7, 9), 158, 54),
    ("Rohan Verma", Sex.MALE, date(1958, 4, 30), 170, 79),
    ("Fatima Khan", Sex.FEMALE, date(1984, 9, 17), 163, 67),
    ("Vikram Nair", Sex.MALE, date(1971, 1, 12), 178, 92),
]

SYMPTOM_CASES = [
    ["itching", "skin_rash", "nodal_skin_eruptions"],
    ["continuous_sneezing", "chills", "watering_from_eyes"],
    ["high_fever", "headache", "nausea", "muscle_pain", "chills"],
    ["chest_pain", "breathlessness", "sweating", "vomiting"],
    ["cough", "high_fever", "breathlessness", "phlegm"],
    ["acidity", "indigestion", "headache", "blurred_and_distorted_vision"],
    ["joint_pain", "neck_pain", "knee_pain", "swelling_joints"],
    ["fatigue", "weight_loss", "restlessness", "lethargy", "irregular_sugar_level"],
]


def _get_or_create_user(email: str, name: str, role: Role, password: str) -> User:
    user = db.session.scalar(db.select(User).filter_by(email=email))
    if user is None:
        user = User(email=email, full_name=name, role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
        click.echo(f"created {role.value}: {email}")
    return user


def _dataset_inputs(disease: str, rng: random.Random) -> list[dict]:
    """Real rows from the training datasets, so demo predictions span every risk level."""
    from medml.data import load

    data = load(disease)
    rows = data.X.sample(n=min(40, len(data.X)), random_state=rng.randint(0, 10_000))
    cases = []
    for _, row in rows.iterrows():
        case = {k: (None if v != v else float(v)) for k, v in row.items()}  # NaN -> None
        cases.append(case)
    return cases


def _seed_demo(doctor: User, doctor2: User, password: str) -> None:
    from .services.predictor import InputError, prediction_service

    rng = random.Random(42)
    service = prediction_service()
    patients: list[Patient] = []
    for i, (name, sex, dob, height, weight) in enumerate(DEMO_PATIENTS):
        email = f"{name.split()[0].lower()}@mediassist.test"
        user = _get_or_create_user(email, name, Role.PATIENT, password)
        if user.patient_profile is None:
            db.session.add(
                Patient(
                    user=user,
                    assigned_doctor_id=(doctor if i < 4 else doctor2).id,
                    date_of_birth=dob,
                    sex=sex,
                    height_cm=height,
                    weight_kg=weight,
                    blood_group=rng.choice(["A+", "B+", "O+", "AB+", "O-"]),
                )
            )
            db.session.flush()
        patients.append(user.patient_profile)

    if db.session.scalar(db.select(db.func.count(Prediction.id))) >= 20:
        click.echo("demo predictions already present")
        return

    pools = {d: _dataset_inputs(d, rng) for d in ("diabetes", "heart", "liver")}
    now = datetime.now(UTC)
    created = 0
    for n in range(60):
        patient = rng.choice(patients)
        disease = rng.choice([Disease.DIABETES, Disease.HEART, Disease.LIVER, Disease.SYMPTOM])
        if disease == Disease.SYMPTOM:
            inputs = {"symptoms": rng.choice(SYMPTOM_CASES)}
        else:
            inputs = pools[disease.value][n % len(pools[disease.value])]
        clinician = patient.assigned_doctor if rng.random() < 0.5 else patient.user
        try:
            prediction = service.create(disease, patient, inputs, clinician)
        except InputError:
            continue  # a few raw rows fall outside the clinical ranges; skip them
        prediction.created_at = now - timedelta(days=rng.randint(0, 29), hours=rng.randint(0, 23))
        if rng.random() < 0.45 and patient.assigned_doctor:
            prediction.review = DoctorReview(
                doctor=patient.assigned_doctor,
                verdict=rng.choices(list(ReviewVerdict), weights=[7, 2, 1])[0],
                notes=rng.choice(
                    [
                        "Agree with the assessment; follow-up tests ordered.",
                        "Discussed lifestyle changes with the patient.",
                        "Clinical picture differs; repeat measurements next visit.",
                        None,
                    ]
                ),
            )
            prediction.status = PredictionStatus.REVIEWED
        created += 1
    click.echo(f"created {created} demo predictions")


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    @click.option("--demo", is_flag=True, help="Also create demo patients and predictions.")
    def seed(demo: bool) -> None:
        """Create demo accounts (idempotent). Use --demo for dashboard sample data."""
        password = os.getenv("DEMO_PASSWORD", "Demo@12345")
        users = {email: _get_or_create_user(email, n, r, password) for email, n, r in DEMO_USERS}
        doctor = users["doctor@mediassist.test"]
        patient_user = users["patient@mediassist.test"]
        if patient_user.patient_profile is None:
            db.session.add(
                Patient(
                    user=patient_user,
                    assigned_doctor_id=doctor.id,
                    date_of_birth=date(1980, 5, 14),
                    sex=Sex.MALE,
                    height_cm=172,
                    weight_kg=81,
                    blood_group="B+",
                )
            )
            db.session.flush()
        if demo:
            _seed_demo(doctor, users["doctor2@mediassist.test"], password)
        db.session.commit()
        current_app.logger.info("seed complete")
        click.echo("seed complete")
