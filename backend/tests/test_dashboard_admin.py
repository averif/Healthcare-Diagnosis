from app.models import Role, User

from .conftest import auth


def test_dashboard_summary_is_scoped(
    client, patient, other_patient, doctor, other_doctor, admin, make_prediction
):
    make_prediction(patient)
    make_prediction(patient, "symptom", {"symptoms": ["chest_pain", "breathlessness"]})
    make_prediction(other_patient)  # first prediction auto-assigns the least-loaded doctor
    assert other_patient.patient_profile.assigned_doctor_id == other_doctor.id

    doc = client.get("/api/dashboard/summary", headers=auth(doctor)).get_json()
    assert doc["totals"] == {"patients": 1, "predictions": 2, "pending_reviews": 2, "high_risk": 2}
    assert doc["by_disease"]["diabetes"] == 1 and doc["by_disease"]["liver"] == 0
    assert len(doc["timeline"]) == 30 and doc["timeline"][-1]["count"] == 2
    assert len(doc["recent"]) == 2
    assert "users_by_role" not in doc

    adm = client.get("/api/dashboard/summary", headers=auth(admin)).get_json()
    assert adm["totals"]["predictions"] == 3
    assert adm["users_by_role"] == {"admin": 1, "doctor": 2, "patient": 2}
    assert adm["unassigned_patients"] == 0

    own = client.get("/api/dashboard/summary", headers=auth(other_patient)).get_json()
    assert own["totals"]["predictions"] == 1


def test_model_cards_endpoint(client, doctor, patient, make_prediction):
    make_prediction(patient)
    cards = client.get("/api/models", headers=auth(doctor)).get_json()
    assert [c["disease"] for c in cards] == ["diabetes", "heart", "liver", "symptom"]
    assert cards[0]["predictions_served"] == 1
    assert "roc_curve" in cards[0]["evaluation"]["test"]
    assert client.get("/api/models", headers=auth(patient)).status_code == 403


def test_admin_user_management(client, admin, patient, db):
    created = client.post(
        "/api/admin/users",
        json={
            "email": "newdoc@test.local",
            "password": "Doct0rPass",
            "full_name": "Dr. New",
            "role": "doctor",
        },
        headers=auth(admin),
    )
    assert created.status_code == 201
    doc_id = created.get_json()["id"]

    doctors = client.get("/api/admin/users?role=doctor", headers=auth(admin)).get_json()
    assert sorted(u["email"] for u in doctors["items"]) == [
        "doctor@test.local",
        "newdoc@test.local",
    ]

    deactivated = client.patch(
        f"/api/admin/users/{doc_id}", json={"is_active": False}, headers=auth(admin)
    )
    assert deactivated.get_json()["is_active"] is False

    self_demote = client.patch(
        f"/api/admin/users/{admin.id}", json={"role": "doctor"}, headers=auth(admin)
    )
    assert self_demote.status_code == 400

    promoted = client.patch(
        f"/api/admin/users/{patient.id}", json={"role": "doctor"}, headers=auth(admin)
    )
    assert promoted.get_json()["role"] == "doctor"
    assert db.session.get(User, patient.id).role == Role.DOCTOR


def test_assign_doctor_and_audit_log(client, admin, doctor, other_patient):
    pid = other_patient.patient_profile.id
    url = f"/api/admin/patients/{pid}/doctor"
    assigned = client.put(url, json={"doctor_id": doctor.id}, headers=auth(admin))
    assert assigned.get_json()["assigned_doctor"]["id"] == doctor.id

    not_a_doctor = client.put(url, json={"doctor_id": admin.id}, headers=auth(admin))
    assert not_a_doctor.status_code == 422

    assert client.get("/api/patients", headers=auth(doctor)).get_json()["total"] == 1

    logs = client.get("/api/admin/audit-logs?action=admin.", headers=auth(admin)).get_json()
    assert logs["items"][0]["action"] == "admin.assign_doctor"
    assert logs["items"][0]["user_email"] == "admin@test.local"


def test_admin_endpoints_require_admin(client, doctor, patient):
    for user in (doctor, patient):
        assert client.get("/api/admin/users", headers=auth(user)).status_code == 403
        assert client.get("/api/admin/audit-logs", headers=auth(user)).status_code == 403


def test_openapi_documents_all_endpoints_with_security(client):
    spec = client.get("/api/openapi.json").get_json()
    assert "bearerAuth" in spec["components"]["securitySchemes"]
    for path in ["/api/auth/login", "/api/predictions/{disease}", "/api/admin/users"]:
        assert path in spec["paths"]
    assert spec["paths"]["/api/admin/users"]["get"]["security"] == [{"bearerAuth": []}]
