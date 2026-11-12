"""Doctor self-registration, manual admin verification, documents and auto-assignment."""

import io

import pytest
from click.testing import CliRunner

from app.models import AuditLog, DoctorProfile, DoctorStatus, Patient, Role, User

from .conftest import auth, make_user

DOCTOR_FIELDS = {
    "license_number": "dmc-2020-12345",
    "issuing_authority": "Delhi  Medical Council",
    "hospital": "City Hospital",
    "specialty": "Cardiology",
}

PDF = b"%PDF-1.4\n%test document\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def register(client, email="newdoc@test.local", **extra):
    body = {"email": email, "password": "Secur3pass", "full_name": "Dr. New", **extra}
    return client.post("/api/auth/register", json=body)


def register_doctor(client, email="newdoc@test.local", **overrides):
    return register(client, email, account_type="doctor", **{**DOCTOR_FIELDS, **overrides})


def bearer(response) -> dict:
    return {"Authorization": f"Bearer {response.get_json()['access_token']}"}


def application_of(email: str, db) -> DoctorProfile:
    return db.session.scalar(db.select(User).filter_by(email=email)).doctor_profile


def doctor_endpoints(prediction_id: int = 1) -> list[tuple[str, str, dict | None]]:
    return [
        ("get", "/api/patients", None),
        ("get", "/api/models", None),
        ("get", "/api/dashboard/summary", None),
        ("get", "/api/predictions", None),
        ("put", f"/api/predictions/{prediction_id}/review", {"verdict": "agree"}),
        ("post", "/api/predictions/diabetes", {"patient_id": 1, "inputs": {}}),
    ]


# ---- registration ---------------------------------------------------------------------------


def test_patient_registration_is_unchanged(client, db):
    response = register(client, "pat@test.local")
    assert response.status_code == 201
    user = response.get_json()["user"]
    assert user["role"] == "patient"
    assert user["patient_id"] is not None
    assert user["doctor_application"] is None
    # patient-only fields are ignored for patients, explicit patient type works too
    explicit = register(client, "pat2@test.local", account_type="patient")
    assert explicit.status_code == 201
    assert explicit.get_json()["user"]["role"] == "patient"


def test_doctor_registration_creates_pending_profile(client, db):
    response = register_doctor(client)
    assert response.status_code == 201, response.get_json()
    user = response.get_json()["user"]
    assert user["role"] == "patient"  # no doctor permissions until approved
    assert user["patient_id"] is None  # and no patient profile either
    app = user["doctor_application"]
    assert app["status"] == "pending"
    assert app["license_number"] == "DMC-2020-12345"  # normalised
    assert app["issuing_authority"] == "Delhi Medical Council"
    assert app["rejection_reason"] is None

    me = client.get("/api/auth/me", headers=bearer(response))
    assert me.status_code == 200
    assert me.get_json()["doctor_application"]["status"] == "pending"

    login = client.post(
        "/api/auth/login", json={"email": "newdoc@test.local", "password": "Secur3pass"}
    )
    assert login.get_json()["user"]["doctor_application"]["status"] == "pending"


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"license_number": ""}, "license_number"),
        ({"license_number": "A"}, "license_number"),
        ({"license_number": "X" * 51}, "license_number"),
        ({"license_number": "<script>"}, "license_number"),
        ({"issuing_authority": ""}, "issuing_authority"),
        ({"issuing_authority": "A" * 121}, "issuing_authority"),
        ({"issuing_authority": "Council<b>"}, "issuing_authority"),
        ({"hospital": "H" * 121}, "hospital"),
        ({"specialty": "S" * 81}, "specialty"),
    ],
)
def test_doctor_registration_validates_fields(client, overrides, field):
    response = register_doctor(client, **overrides)
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


def test_doctor_registration_requires_licence_fields(client):
    response = register(client, account_type="doctor")
    assert response.status_code == 422
    errors = response.get_json()["errors"]["json"]
    assert {"license_number", "issuing_authority"} <= set(errors)


def test_duplicate_licence_is_rejected(client, db):
    assert register_doctor(client, "a@test.local").status_code == 201
    # same licence and authority, different case/spacing
    dup = register_doctor(
        client,
        "b@test.local",
        license_number="DMC-2020-12345",
        issuing_authority="delhi medical council",
    )
    assert dup.status_code == 409
    # the same number at a different authority is a different licence
    other = register_doctor(client, "c@test.local", issuing_authority="Kerala Medical Council")
    assert other.status_code == 201


# ---- privilege escalation -----------------------------------------------------------------


def test_client_cannot_choose_role(client, db):
    for body in (
        {"role": "doctor"},
        {"role": "admin"},
        {"account_type": "doctor", "role": "doctor", **DOCTOR_FIELDS},
    ):
        response = register(client, "esc@test.local", **body)
        assert response.status_code == 422
        assert "role" in response.get_json()["errors"]["json"]
    assert db.session.scalar(db.select(User).filter_by(email="esc@test.local")) is None

    bad_type = register(client, "esc@test.local", account_type="admin")
    assert bad_type.status_code == 422


def test_pending_doctor_is_blocked_everywhere(client, patient, make_prediction, db):
    prediction = make_prediction(patient)
    response = register_doctor(client)
    headers = bearer(response)
    for method, url, body in doctor_endpoints(prediction["id"]):
        res = getattr(client, method)(url, json=body, headers=headers)
        assert res.status_code == 403, (url, res.get_json())
    # no patient data through patient endpoints either
    assert client.get("/api/patients/me", headers=headers).status_code == 403
    patient_id = patient.patient_profile.id
    assert client.get(f"/api/patients/{patient_id}", headers=headers).status_code == 403
    assert client.get(f"/api/predictions/{prediction['id']}", headers=headers).status_code == 403
    # the account itself is still reachable
    assert client.get("/api/auth/me", headers=headers).status_code == 200


def test_approval_grants_doctor_access(client, admin, patient, db):
    response = register_doctor(client)
    application = application_of("newdoc@test.local", db)

    approved = client.post(
        f"/api/admin/doctor-applications/{application.id}/approve", headers=auth(admin)
    )
    assert approved.status_code == 200, approved.get_json()
    body = approved.get_json()
    assert body["status"] == "approved"
    assert body["reviewed_by"]["id"] == admin.id
    assert body["reviewed_at"] is not None
    assert body["user"]["role"] == "doctor"

    # the same (pre-approval) token now works: role is looked up from the database
    headers = bearer(response)
    assert client.get("/api/patients", headers=headers).status_code == 200
    assert client.get("/api/models", headers=headers).status_code == 200
    me = client.get("/api/auth/me", headers=headers).get_json()
    assert me["role"] == "doctor" and me["doctor_application"]["status"] == "approved"

    log = db.session.scalar(db.select(AuditLog).filter_by(action="admin.doctor_approve"))
    assert log.user_id == admin.id and log.entity_id == application.id

    again = client.post(
        f"/api/admin/doctor-applications/{application.id}/approve", headers=auth(admin)
    )
    assert again.status_code == 409


def test_rejection_blocks_and_stores_reason(client, admin, db):
    response = register_doctor(client)
    application = application_of("newdoc@test.local", db)
    url = f"/api/admin/doctor-applications/{application.id}/reject"

    assert client.post(url, json={}, headers=auth(admin)).status_code == 422
    assert client.post(url, json={"reason": "  no "}, headers=auth(admin)).status_code == 422

    rejected = client.post(
        url, json={"reason": "  Licence number not found in the register.  "}, headers=auth(admin)
    )
    assert rejected.status_code == 200
    assert rejected.get_json()["status"] == "rejected"

    headers = bearer(response)
    me = client.get("/api/auth/me", headers=headers).get_json()
    assert me["role"] == "patient"
    assert me["doctor_application"]["status"] == "rejected"
    assert (
        me["doctor_application"]["rejection_reason"] == "Licence number not found in the register."
    )
    for method, url_, body in doctor_endpoints():
        assert getattr(client, method)(url_, json=body, headers=headers).status_code == 403

    log = db.session.scalar(db.select(AuditLog).filter_by(action="admin.doctor_reject"))
    assert log.details["reason"] == "Licence number not found in the register."
    # a decided application cannot be rejected twice
    assert client.post(url, json={"reason": "Again please"}, headers=auth(admin)).status_code == 409


def test_only_admins_review_applications(client, admin, doctor, patient, db):
    register_doctor(client)
    other = register_doctor(client, "other@test.local", license_number="KMC-77")
    application = application_of("newdoc@test.local", db)
    base = f"/api/admin/doctor-applications/{application.id}"
    for user_headers in (auth(doctor), auth(patient), bearer(other)):
        assert client.get("/api/admin/doctor-applications", headers=user_headers).status_code == 403
        assert client.post(f"{base}/approve", headers=user_headers).status_code == 403
        assert (
            client.post(f"{base}/reject", json={"reason": "Nope nope"}, headers=user_headers)
        ).status_code == 403
        assert client.get(f"{base}/document", headers=user_headers).status_code == 403
    assert client.post(f"{base}/approve").status_code == 401
    assert application_of("newdoc@test.local", db).status == DoctorStatus.PENDING


def test_admin_cannot_bypass_review_with_role_change(client, admin, db):
    register_doctor(client)
    user = db.session.scalar(db.select(User).filter_by(email="newdoc@test.local"))
    res = client.patch(f"/api/admin/users/{user.id}", json={"role": "doctor"}, headers=auth(admin))
    assert res.status_code == 409
    # editing other fields must not silently give the applicant a patient profile
    res = client.patch(
        f"/api/admin/users/{user.id}", json={"full_name": "Dr. X"}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert res.get_json()["patient_id"] is None


def test_list_and_get_applications(client, admin, db):
    register_doctor(client, "a@test.local", license_number="AAA-1")
    register_doctor(client, "b@test.local", license_number="BBB-2")
    b = application_of("b@test.local", db)
    client.post(f"/api/admin/doctor-applications/{b.id}/approve", headers=auth(admin))

    pending = client.get(
        "/api/admin/doctor-applications?status=pending", headers=auth(admin)
    ).get_json()
    assert pending["total"] == 1
    item = pending["items"][0]
    assert item["user"]["email"] == "a@test.local"
    assert item["license_number"] == "AAA-1"
    assert item["issuing_authority"] == "Delhi Medical Council"
    assert item["hospital"] == "City Hospital"
    assert item["has_document"] is False

    everything = client.get(
        "/api/admin/doctor-applications?page_size=1", headers=auth(admin)
    ).get_json()
    assert everything["total"] == 2 and everything["pages"] == 2

    one = client.get(f"/api/admin/doctor-applications/{b.id}", headers=auth(admin))
    assert one.get_json()["status"] == "approved"
    assert client.get("/api/admin/doctor-applications/999", headers=auth(admin)).status_code == 404
    bad = client.get("/api/admin/doctor-applications?status=maybe", headers=auth(admin))
    assert bad.status_code == 422


# ---- documents --------------------------------------------------------------------------------


def upload(client, headers, data: bytes, filename: str, mimetype: str):
    return client.post(
        "/api/auth/doctor-application/document",
        data={"document": (io.BytesIO(data), filename, mimetype)},
        headers=headers,
        content_type="multipart/form-data",
    )


def test_document_upload_and_admin_download(client, admin, app, db):
    headers = bearer(register_doctor(client))
    res = upload(client, headers, PDF, "licence.pdf", "application/pdf")
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["doctor_application"]["has_document"] is True

    application = application_of("newdoc@test.local", db)
    stored = application.document_path
    assert stored.endswith(".pdf") and "licence" not in stored  # random name
    docs_dir = app.config["DOCTOR_DOCS_DIR"]
    assert (docs_dir / stored).read_bytes() == PDF

    download = client.get(
        f"/api/admin/doctor-applications/{application.id}/document", headers=auth(admin)
    )
    assert download.status_code == 200
    assert download.data == PDF
    assert download.mimetype == "application/pdf"
    assert download.headers["X-Content-Type-Options"] == "nosniff"

    # replacing the document removes the old file
    assert upload(client, headers, PNG, "scan.PNG", "image/png").status_code == 200
    assert not (docs_dir / stored).exists()


@pytest.mark.parametrize(
    "data, filename, mimetype, message",
    [
        (b"MZ\x90\x00", "virus.exe", "application/octet-stream", "PDF, JPG or PNG"),
        (b"<svg></svg>", "x.svg", "image/svg+xml", "PDF, JPG or PNG"),
        (b"<html>hi</html>", "fake.pdf", "application/pdf", "not a valid"),
        (PNG, "image.pdf", "application/pdf", "not a valid"),
        (PDF, "doc.pdf", "image/png", "does not match"),
        (b"", "empty.png", "image/png", "empty"),
        (b"%PDF-" + b"0" * (5 * 1024 * 1024), "big.pdf", "application/pdf", "5 MB"),
    ],
)
def test_document_upload_validation(client, db, app, data, filename, mimetype, message):
    headers = bearer(register_doctor(client))
    res = upload(client, headers, data, filename, mimetype)
    assert res.status_code == 422
    assert message in res.get_json()["message"]
    assert application_of("newdoc@test.local", db).document_path is None
    docs_dir = app.config["DOCTOR_DOCS_DIR"]
    assert not docs_dir.exists() or not any(docs_dir.iterdir())


def test_document_upload_limits(client, admin, patient, db):
    # patients and admins have no application
    assert upload(client, auth(patient), PDF, "a.pdf", "application/pdf").status_code == 403
    response = register_doctor(client)
    headers = bearer(response)
    missing = client.post(
        "/api/auth/doctor-application/document", headers=headers, content_type="multipart/form-data"
    )
    assert missing.status_code == 422
    # once decided, the document is frozen
    application = application_of("newdoc@test.local", db)
    client.post(f"/api/admin/doctor-applications/{application.id}/approve", headers=auth(admin))
    assert upload(client, headers, PDF, "a.pdf", "application/pdf").status_code == 403
    # no document uploaded -> 404 for the admin
    res = client.get(
        f"/api/admin/doctor-applications/{application.id}/document", headers=auth(admin)
    )
    assert res.status_code == 404


# ---- auto-assignment ---------------------------------------------------------------------------


def _assigned_doctor_id(email: str, db) -> int | None:
    user = db.session.scalar(db.select(User).filter_by(email=email))
    return user.patient_profile.assigned_doctor_id


def test_new_patient_gets_least_loaded_doctor(client, db, doctor, other_doctor, patient):
    # `patient` is assigned to `doctor`, so `other_doctor` has the lighter load
    register(client, "p1@test.local")
    assert _assigned_doctor_id("p1@test.local", db) == other_doctor.id
    # now 1 each: the tie goes to the oldest doctor account
    register(client, "p2@test.local")
    assert _assigned_doctor_id("p2@test.local", db) == doctor.id


def test_unapproved_and_inactive_doctors_are_not_assigned(client, admin, db):
    make_user("off@test.local", Role.DOCTOR, "Dr. Off", active=False)
    db.session.commit()
    register_doctor(client)  # pending applicant
    register(client, "p1@test.local")
    assert _assigned_doctor_id("p1@test.local", db) is None


def test_no_doctor_leaves_patient_unassigned_then_prediction_assigns(
    client, admin, db, make_prediction
):
    response = register(client, "p1@test.local")
    assert response.status_code == 201
    assert _assigned_doctor_id("p1@test.local", db) is None

    # a doctor is approved later; the patient's first prediction picks them up
    register_doctor(client)
    application = application_of("newdoc@test.local", db)
    client.post(f"/api/admin/doctor-applications/{application.id}/approve", headers=auth(admin))
    user = db.session.scalar(db.select(User).filter_by(email="p1@test.local"))
    make_prediction(user)
    assert _assigned_doctor_id("p1@test.local", db) == application.user_id


def test_assign_unassigned_cli(app, db, doctor, other_doctor):
    users = [make_user(f"u{i}@test.local", Role.PATIENT) for i in range(3)]
    for user in users:
        db.session.add(Patient(user=user))
    db.session.commit()

    result = CliRunner().invoke(app.cli, ["assign-unassigned"], obj=None)
    assert result.exit_code == 0, result.output
    assert "assigned 3 patient(s); 0 still unassigned" in result.output
    loads = sorted(
        db.session.scalar(db.select(db.func.count(Patient.id)).filter_by(assigned_doctor_id=d.id))
        for d in (doctor, other_doctor)
    )
    assert loads == [1, 2]


def test_deactivating_doctor_reassigns_patients(client, admin, doctor, other_doctor, patient, db):
    res = client.patch(
        f"/api/admin/users/{doctor.id}", json={"is_active": False}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert patient.patient_profile.assigned_doctor_id == other_doctor.id
    log = db.session.scalar(
        db.select(AuditLog).filter_by(action="admin.user_update", entity_id=doctor.id)
    )
    assert log.details["reassigned_patients"] == 1

    # with no other doctor left, patients become unassigned rather than erroring
    res = client.patch(
        f"/api/admin/users/{other_doctor.id}", json={"is_active": False}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert patient.patient_profile.assigned_doctor_id is None


def test_seeded_doctors_are_pre_approved(app, db):
    from app.cli import seed_database

    seed_database()
    doctor = db.session.scalar(db.select(User).filter_by(email="doctor@mediassist.test"))
    assert doctor.role == Role.DOCTOR
    assert doctor.doctor_profile.status == DoctorStatus.APPROVED
    assert not doctor.is_doctor_applicant
