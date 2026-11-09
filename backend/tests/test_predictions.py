from app.models import ModelVersion, Prediction

from .conftest import DIABETES_INPUTS, auth


def test_modules_catalogue_drives_the_forms(client, patient):
    modules = client.get("/api/predictions/modules", headers=auth(patient)).get_json()
    assert [m["disease"] for m in modules] == ["diabetes", "heart", "liver", "symptom"]
    diabetes = modules[0]
    glucose = next(f for f in diabetes["features"] if f["name"] == "Glucose")
    assert (glucose["min"], glucose["max"], glucose["unit"]) == (40, 300, "mg/dL")
    symptoms = modules[3]["symptoms"]
    assert len(symptoms) == 131
    assert any(s["name"] == "chest_pain" and s["red_flag"] for s in symptoms)
    assert client.get("/api/predictions/modules/cancer", headers=auth(patient)).status_code == 404


def test_patient_runs_explained_diabetes_prediction(client, patient, db, make_prediction):
    result = make_prediction(patient)
    assert result["predicted_label"] == "Diabetic"
    assert result["risk_level"] == "high"
    assert result["status"] == "pending_review"
    assert result["explanation"]["reasons"][0]["feature"] == "Glucose"
    assert result["guidance"] and "disclaimer" in result
    assert result["model"]["algorithm"] == "DecisionTreeClassifier"
    assert result["input_data"]["Insulin"] is None

    stored = db.session.get(Prediction, result["id"])
    assert stored.model_version.is_active
    assert db.session.scalar(db.select(db.func.count(ModelVersion.id))) == 1


def test_invalid_inputs_return_field_errors(client, patient):
    response = client.post(
        "/api/predictions/diabetes",
        json={"inputs": DIABETES_INPUTS | {"Glucose": 900, "BMI": None}},
        headers=auth(patient),
    )
    assert response.status_code == 422
    errors = response.get_json()["errors"]["json"]["inputs"]
    assert set(errors) == {"Glucose", "BMI"}


def test_input_red_flags(client, patient, make_prediction):
    result = make_prediction(patient, inputs=DIABETES_INPUTS | {"Glucose": 280})
    assert any("Very high blood glucose" in f for f in result["red_flags"])


def test_symptom_prediction_triage_and_red_flags(client, patient, make_prediction):
    urgent = make_prediction(
        patient, "symptom", {"symptoms": ["chest_pain", "breathlessness", "sweating", "vomiting"]}
    )
    assert urgent["predicted_label"] == "Heart attack"
    assert urgent["risk_level"] == "high"
    assert len(urgent["red_flags"]) == 2
    assert "emergency" in urgent["guidance"][0]
    assert len(urgent["top_conditions"]) >= 1

    mild = make_prediction(
        patient, "symptom", {"symptoms": ["itching", "skin_rash", "nodal_skin_eruptions"]}
    )
    assert mild["predicted_label"] == "Fungal infection"
    assert mild["risk_level"] == "low"
    assert mild["red_flags"] == []


def test_doctor_predicts_for_assigned_patients_only(
    client, doctor, patient, other_patient, make_prediction
):
    pid = patient.patient_profile.id
    result = make_prediction(doctor, patient_id=pid)
    assert result["patient_id"] == pid and result["created_by"] == "Dr. Meera Rao"

    no_id = client.post(
        "/api/predictions/diabetes", json={"inputs": DIABETES_INPUTS}, headers=auth(doctor)
    )
    assert no_id.status_code == 422
    other = client.post(
        "/api/predictions/diabetes",
        json={"inputs": DIABETES_INPUTS, "patient_id": other_patient.patient_profile.id},
        headers=auth(doctor),
    )
    assert other.status_code == 404


def test_patient_cannot_predict_for_someone_else(client, patient, other_patient):
    response = client.post(
        "/api/predictions/diabetes",
        json={"inputs": DIABETES_INPUTS, "patient_id": other_patient.patient_profile.id},
        headers=auth(patient),
    )
    assert response.status_code == 403


def test_admin_cannot_run_predictions(client, admin):
    response = client.post(
        "/api/predictions/diabetes", json={"inputs": DIABETES_INPUTS}, headers=auth(admin)
    )
    assert response.status_code == 403


def test_history_is_scoped_filtered_and_paginated(
    client, patient, other_patient, doctor, make_prediction
):
    for _ in range(3):
        make_prediction(patient)
    make_prediction(patient, "symptom", {"symptoms": ["itching", "skin_rash"]})
    make_prediction(other_patient)

    own = client.get("/api/predictions?page_size=2", headers=auth(patient)).get_json()
    assert own["total"] == 4 and own["pages"] == 2 and len(own["items"]) == 2

    symptom_only = client.get("/api/predictions?disease=symptom", headers=auth(patient)).get_json()
    assert symptom_only["total"] == 1

    assert client.get("/api/predictions", headers=auth(doctor)).get_json()["total"] == 4
    assert client.get("/api/predictions", headers=auth(other_patient)).get_json()["total"] == 1


def test_prediction_detail_access_control(client, patient, other_patient, make_prediction):
    pred = make_prediction(patient)
    assert client.get(f"/api/predictions/{pred['id']}", headers=auth(patient)).status_code == 200
    assert (
        client.get(f"/api/predictions/{pred['id']}", headers=auth(other_patient)).status_code == 404
    )


def test_doctor_review_workflow(client, doctor, other_doctor, patient, make_prediction):
    pred = make_prediction(patient)
    url = f"/api/predictions/{pred['id']}/review"
    body = {"verdict": "agree", "notes": "Order HbA1c and fasting glucose."}

    assert client.put(url, json=body, headers=auth(patient)).status_code == 403
    assert client.put(url, json=body, headers=auth(other_doctor)).status_code == 404
    assert client.put(url, json={"verdict": "maybe"}, headers=auth(doctor)).status_code == 422

    reviewed = client.put(url, json=body, headers=auth(doctor)).get_json()
    assert reviewed["status"] == "reviewed"
    assert reviewed["review"]["verdict"] == "agree"
    assert reviewed["review"]["doctor"]["full_name"] == "Dr. Meera Rao"

    updated = client.put(url, json={"verdict": "disagree"}, headers=auth(doctor)).get_json()
    assert updated["review"]["verdict"] == "disagree" and updated["review"]["notes"] is None

    seen_by_patient = client.get(f"/api/predictions/{pred['id']}", headers=auth(patient))
    assert seen_by_patient.get_json()["review"]["verdict"] == "disagree"
