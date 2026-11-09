def test_health_endpoint_reports_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["version"]
    assert body["assistant"] == "rules"  # tests never use a paid API


def test_openapi_spec_is_published(client):
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    assert "/api/health" in response.get_json()["paths"]


def test_production_refuses_default_secrets(monkeypatch):
    import pytest

    from app import create_app

    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        create_app("production")

    monkeypatch.setenv("SECRET_KEY", "s" * 40)
    monkeypatch.setenv("JWT_SECRET_KEY", "j" * 40)
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    assert create_app("production").config["DEBUG"] is False


def test_behind_proxy_uses_forwarded_client_ip(tmp_path):
    from app import create_app
    from app.extensions import db
    from app.models import AuditLog

    app = create_app("testing", {"BEHIND_PROXY": True, "REPORTS_DIR": tmp_path})
    with app.app_context():
        db.create_all()
        app.test_client().post(
            "/api/auth/login",
            json={"email": "nobody@test.local", "password": "Wrong1234"},
            headers={"X-Forwarded-For": "203.0.113.7"},
        )
        log = db.session.scalar(db.select(AuditLog).filter_by(action="auth.login_failed"))
        assert log.ip_address == "203.0.113.7"
