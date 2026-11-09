from app.models import AuditLog

from .conftest import auth


def test_patient_reads_and_updates_own_profile(client, patient):
    me = client.get("/api/patients/me", headers=auth(patient)).get_json()
    assert me["full_name"] == "Aarav Sharma"
    assert me["bmi"] == 27.4
    assert me["assigned_doctor"]["full_name"] == "Dr. Meera Rao"

    updated = client.put(
        "/api/patients/me",
        json={"full_name": "Aarav K. Sharma", "blood_group": "B+", "weight_kg": 78},
        headers=auth(patient),
    )
    assert updated.status_code == 200
    assert updated.get_json()["full_name"] == "Aarav K. Sharma"
    assert updated.get_json()["blood_group"] == "B+"


def test_profile_validation(client, patient):
    bad = client.put(
        "/api/patients/me",
        json={"blood_group": "Z+", "height_cm": 20, "date_of_birth": "2999-01-01"},
        headers=auth(patient),
    )
    assert bad.status_code == 422
    assert set(bad.get_json()["errors"]["json"]) == {"blood_group", "height_cm", "date_of_birth"}


def test_doctor_sees_only_assigned_patients(client, doctor, patient, other_patient):
    page = client.get("/api/patients", headers=auth(doctor)).get_json()
    assert page["total"] == 1
    assert page["items"][0]["full_name"] == "Aarav Sharma"
    other_id = other_patient.patient_profile.id
    assert client.get(f"/api/patients/{other_id}", headers=auth(doctor)).status_code == 404


def test_admin_sees_all_patients_and_search(client, admin, patient, other_patient):
    page = client.get("/api/patients?search=kavya", headers=auth(admin)).get_json()
    assert [p["full_name"] for p in page["items"]] == ["Kavya Iyer"]
    assert client.get("/api/patients", headers=auth(admin)).get_json()["total"] == 2


def test_patients_cannot_list_or_view_others(client, patient, other_patient):
    assert client.get("/api/patients", headers=auth(patient)).status_code == 403
    other_id = other_patient.patient_profile.id
    assert client.get(f"/api/patients/{other_id}", headers=auth(patient)).status_code == 404
    own_id = patient.patient_profile.id
    assert client.get(f"/api/patients/{own_id}", headers=auth(patient)).status_code == 200


def test_clinician_record_access_is_audited(client, doctor, patient, db):
    client.get(f"/api/patients/{patient.patient_profile.id}", headers=auth(doctor))
    log = db.session.scalar(db.select(AuditLog).filter_by(action="patient.view"))
    assert log.user_id == doctor.id and log.entity_id == patient.patient_profile.id
