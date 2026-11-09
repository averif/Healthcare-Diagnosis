from .conftest import auth


def test_generate_and_download_pdf_report(client, app, patient, doctor, make_prediction):
    pred = make_prediction(patient)
    client.put(
        f"/api/predictions/{pred['id']}/review",
        json={"verdict": "agree", "notes": "Repeat test in 3 months."},
        headers=auth(doctor),
    )

    response = client.post(f"/api/predictions/{pred['id']}/report", headers=auth(patient))
    assert response.status_code == 200
    assert response.mimetype == "application/pdf"
    assert response.data.startswith(b"%PDF")
    code = response.headers["X-Report-Code"]
    assert code.startswith("RPT-")
    assert f"MediAssist-{code}.pdf" in response.headers["Content-Disposition"]
    assert (app.config["REPORTS_DIR"] / f"{code}.pdf").exists()

    detail = client.get(f"/api/predictions/{pred['id']}", headers=auth(patient)).get_json()
    assert detail["report_codes"] == [code]

    again = client.get(f"/api/reports/{code.lower()}", headers=auth(doctor))
    assert again.status_code == 200 and again.data.startswith(b"%PDF")


def test_symptom_report_and_regeneration(client, app, patient, make_prediction):
    pred = make_prediction(patient, "symptom", {"symptoms": ["chest_pain", "breathlessness"]})
    response = client.post(f"/api/predictions/{pred['id']}/report", headers=auth(patient))
    code = response.headers["X-Report-Code"]
    (app.config["REPORTS_DIR"] / f"{code}.pdf").unlink()  # file cleaned up
    again = client.get(f"/api/reports/{code}", headers=auth(patient))
    assert again.status_code == 200 and again.data.startswith(b"%PDF")


def test_report_access_control(client, patient, other_patient, make_prediction):
    pred = make_prediction(patient)
    code = client.post(f"/api/predictions/{pred['id']}/report", headers=auth(patient)).headers[
        "X-Report-Code"
    ]
    assert client.get(f"/api/reports/{code}", headers=auth(other_patient)).status_code == 404
    assert client.get("/api/reports/RPT-00000000", headers=auth(patient)).status_code == 404
