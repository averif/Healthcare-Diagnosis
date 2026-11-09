"""Custom `flask` CLI commands, e.g. `flask seed` to create demo accounts for the viva."""

import os
from datetime import date

import click
from flask import Flask

from .extensions import db
from .models import Patient, Role, Sex, User

# Local demo accounts only. Override the password with DEMO_PASSWORD in .env.
DEMO_USERS = [
    ("admin@mediassist.test", "System Admin", Role.ADMIN),
    ("doctor@mediassist.test", "Dr. Saman Verma", Role.DOCTOR),
    ("patient@mediassist.test", "Aarav Sharma", Role.PATIENT),
]


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    def seed() -> None:
        """Create demo admin, doctor and patient accounts (idempotent)."""
        password = os.getenv("DEMO_PASSWORD", "Demo@12345")
        users: dict[Role, User] = {}
        for email, name, role in DEMO_USERS:
            user = db.session.scalar(db.select(User).filter_by(email=email))
            if user is None:
                user = User(email=email, full_name=name, role=role)
                user.set_password(password)
                db.session.add(user)
                click.echo(f"created {role.value}: {email}")
            users[role] = user
        db.session.flush()

        patient_user = users[Role.PATIENT]
        if patient_user.patient_profile is None:
            db.session.add(
                Patient(
                    user=patient_user,
                    assigned_doctor_id=users[Role.DOCTOR].id,
                    date_of_birth=date(1980, 5, 14),
                    sex=Sex.MALE,
                    height_cm=172,
                    weight_kg=81,
                    blood_group="B+",
                )
            )
        db.session.commit()
        click.echo("seed complete")
