def test_health_endpoint_reports_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["version"]


def test_openapi_spec_is_published(client):
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "/api/health" in response.get_json()["paths"]
