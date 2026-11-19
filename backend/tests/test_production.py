"""Production hardening checks: config validation, health probes, admin CLI."""

import pytest

from app import create_app

STRONG_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef"


def _production_config(**overrides):
    config = {
        "TESTING": True,
        "ENVIRONMENT": "production",
        "IS_PRODUCTION": True,
        "SQLALCHEMY_DATABASE_URI": (
            "postgresql+psycopg2://mediflow:test-password@db:5432/mediflow"
        ),
        "SQLALCHEMY_ENGINE_OPTIONS": {},
        "JWT_SECRET_KEY": STRONG_SECRET,
        "SECRET_KEY": "abcdef0123456789abcdef0123456789abcdef0123456789",
        "JWT_ACCESS_TOKEN_HOURS": 12,
        "CORS_ALLOWED_ORIGINS": ["https://mediflow.example.com"],
        "REGISTRATION_ALLOWED_ROLES": ["retailer"],
        "DEBUG": False,
        "PORT": 5000,
        "LOG_LEVEL": "CRITICAL",
    }
    config.update(overrides)
    return config


def test_liveness_and_database_readiness_are_separate(client):
    for path in ("/api/health", "/api/health/live"):
        response = client.get(path)
        assert response.status_code == 200
        body = response.get_json()
        assert body["status"] == "ok"
        assert "database" not in body

    ready = client.get("/api/health/ready")
    assert ready.status_code == 200
    body = ready.get_json()
    assert body["status"] == "ready"
    assert body["database"] == "ok"


def test_health_responses_do_not_expose_configuration(client):
    for path in ("/api/health", "/api/health/live", "/api/health/ready"):
        body = client.get(path).get_json()
        serialized = repr(body).lower()
        assert "password" not in serialized
        assert "secret" not in serialized
        assert "database_url" not in serialized
        assert "postgresql://" not in serialized


def test_cors_allows_only_configured_origins(client):
    allowed = client.get(
        "/api/health", headers={"Origin": "http://localhost:5173"}
    )
    assert allowed.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"

    denied = client.get(
        "/api/health", headers={"Origin": "https://evil.example.com"}
    )
    assert denied.headers.get("Access-Control-Allow-Origin") is None


def test_production_config_accepts_hardened_values():
    app = create_app(_production_config())
    assert app.config["ENVIRONMENT"] == "production"
    assert app.config["DEBUG"] is False
    assert app.config["PROPAGATE_EXCEPTIONS"] is False


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"JWT_SECRET_KEY": "dev-only-change-me"}, "JWT_SECRET_KEY"),
        ({"JWT_SECRET_KEY": "short"}, "JWT_SECRET_KEY"),
        ({"SQLALCHEMY_DATABASE_URI": "sqlite://"}, "PostgreSQL"),
        ({"DEBUG": True}, "FLASK_DEBUG"),
        ({"CORS_ALLOWED_ORIGINS": ["*"]}, "wildcard"),
        (
            {"REGISTRATION_ALLOWED_ROLES": ["admin", "retailer"]},
            "privileged roles",
        ),
        ({"LLM_PROVIDER": "unknown"}, "LLM_PROVIDER"),
        ({"LLM_MODEL": ""}, "LLM_MODEL"),
        ({"LLM_TIMEOUT": 0}, "LLM_TIMEOUT"),
        ({"AI_RATE_LIMIT_WINDOW_SECONDS": 0}, "AI_RATE_LIMIT_WINDOW_SECONDS"),
    ],
)
def test_production_config_rejects_unsafe_values(overrides, message):
    with pytest.raises(RuntimeError, match=message):
        create_app(_production_config(**overrides))


def test_create_admin_cli_creates_working_administrator(client, app):
    result = app.test_cli_runner().invoke(
        args=[
            "create-admin",
            "--email",
            "ops@example.com",
            "--password",
            "strongpass123",
            "--name",
            "Ops Administrator",
        ]
    )
    assert result.exit_code == 0, result.output
    assert "Administrator created" in result.output

    login = client.post(
        "/api/auth/login",
        json={"email": "ops@example.com", "password": "strongpass123"},
    )
    assert login.status_code == 200
    assert login.get_json()["user"]["role"] == "admin"
