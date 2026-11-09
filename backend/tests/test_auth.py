import pytest

from app import create_app
from app.extensions import db as _db
from app.models import AuditLog, User

from .conftest import PASSWORD, auth


def register(client, email="new@test.local", password="Secur3pass", name="New Patient"):
    return client.post(
        "/api/auth/register", json={"email": email, "password": password, "full_name": name}
    )


def test_register_creates_patient_with_profile(client, db):
    response = register(client, email="New@Test.local")
    assert response.status_code == 201
    body = response.get_json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["role"] == "patient"
    assert body["user"]["email"] == "new@test.local"  # normalised
    user = db.session.scalar(db.select(User).filter_by(email="new@test.local"))
    assert user.patient_profile is not None
    assert body["user"]["patient_id"] == user.patient_profile.id


def test_register_rejects_duplicates_and_weak_passwords(client):
    assert register(client).status_code == 201
    assert register(client).status_code == 409
    weak = register(client, email="weak@test.local", password="password")
    assert weak.status_code == 422
    assert "password" in weak.get_json()["errors"]["json"]


def test_login_success_and_failure_are_audited(client, patient, db):
    ok = client.post("/api/auth/login", json={"email": patient.email, "password": PASSWORD})
    assert ok.status_code == 200
    assert ok.get_json()["user"]["full_name"] == "Aarav Sharma"

    bad = client.post("/api/auth/login", json={"email": patient.email, "password": "nope12345"})
    assert bad.status_code == 401
    assert bad.get_json()["message"] == "Invalid email or password."

    actions = db.session.scalars(db.select(AuditLog.action)).all()
    assert "auth.login" in actions and "auth.login_failed" in actions
    assert db.session.get(User, patient.id).last_login_at is not None


def test_me_requires_a_valid_token(client, patient):
    assert client.get("/api/auth/me").status_code == 401
    bad = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert bad.status_code == 401 and bad.get_json()["message"] == "Invalid token."
    me = client.get("/api/auth/me", headers=auth(patient))
    assert me.status_code == 200 and me.get_json()["email"] == patient.email


def test_refresh_and_logout_revokes_token(client, patient):
    tokens = client.post(
        "/api/auth/login", json={"email": patient.email, "password": PASSWORD}
    ).get_json()
    access = {"Authorization": f"Bearer {tokens['access_token']}"}
    refresh = {"Authorization": f"Bearer {tokens['refresh_token']}"}

    assert client.post("/api/auth/refresh", headers=access).status_code == 401  # wrong type
    renewed = client.post("/api/auth/refresh", headers=refresh)
    assert renewed.status_code == 200 and renewed.get_json()["access_token"]

    assert client.post("/api/auth/logout", headers=access).status_code == 200
    revoked = client.get("/api/auth/me", headers=access)
    assert revoked.status_code == 401
    assert revoked.get_json()["message"] == "Token has been revoked."


def test_deactivated_user_is_locked_out(client, patient, db):
    headers = auth(patient)
    patient.is_active = False
    db.session.commit()
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    login = client.post("/api/auth/login", json={"email": patient.email, "password": PASSWORD})
    assert login.status_code == 403


@pytest.fixture
def limited_client(tmp_path):
    app = create_app("testing", {"RATELIMIT_ENABLED": True, "LOGIN_RATE_LIMIT": "3 per minute"})
    with app.app_context():
        _db.create_all()
        yield app.test_client()
        _db.session.remove()
        _db.drop_all()


def test_login_is_rate_limited(limited_client):
    body = {"email": "nobody@test.local", "password": "Wrong1234"}
    codes = [limited_client.post("/api/auth/login", json=body).status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]
