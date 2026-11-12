from datetime import date

import pytest
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db as _db
from app.models import Patient, Role, Sex, User

PASSWORD = "Passw0rd!"

DIABETES_INPUTS = {
    "Pregnancies": 2,
    "Glucose": 168,
    "BloodPressure": 74,
    "SkinThickness": None,
    "Insulin": None,
    "BMI": 33.1,
    "DiabetesPedigreeFunction": 0.62,
    "Age": 47,
}


@pytest.fixture
def app(tmp_path):
    app = create_app(
        "testing",
        {"REPORTS_DIR": tmp_path / "reports", "DOCTOR_DOCS_DIR": tmp_path / "doctor_docs"},
    )
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(app):
    return _db


def make_user(email: str, role: Role, name: str = "Test User", active: bool = True) -> User:
    user = User(email=email, full_name=name, role=role, is_active=active)
    user.set_password(PASSWORD)
    _db.session.add(user)
    _db.session.flush()
    return user


@pytest.fixture
def doctor(app):
    user = make_user("doctor@test.local", Role.DOCTOR, "Dr. Meera Rao")
    _db.session.commit()
    return user


@pytest.fixture
def other_doctor(app):
    user = make_user("doctor2@test.local", Role.DOCTOR, "Dr. Arjun Patel")
    _db.session.commit()
    return user


@pytest.fixture
def admin(app):
    user = make_user("admin@test.local", Role.ADMIN, "Admin")
    _db.session.commit()
    return user


@pytest.fixture
def patient(app, doctor):
    """A patient user with a profile, assigned to `doctor`."""
    user = make_user("patient@test.local", Role.PATIENT, "Aarav Sharma")
    _db.session.add(
        Patient(
            user=user,
            assigned_doctor_id=doctor.id,
            date_of_birth=date(1980, 5, 14),
            sex=Sex.MALE,
            height_cm=172,
            weight_kg=81,
        )
    )
    _db.session.commit()
    return user


@pytest.fixture
def other_patient(app):
    """A patient not assigned to any doctor."""
    user = make_user("other@test.local", Role.PATIENT, "Kavya Iyer")
    _db.session.add(Patient(user=user))
    _db.session.commit()
    return user


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(identity=user)}"}


@pytest.fixture
def make_prediction(client):
    def _make(user: User, disease="diabetes", inputs=None, patient_id=None):
        body = {"inputs": inputs or DIABETES_INPUTS}
        if patient_id is not None:
            body["patient_id"] = patient_id
        response = client.post(f"/api/predictions/{disease}", json=body, headers=auth(user))
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    return _make
