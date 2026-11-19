"""Application configuration.

Every deployment-specific value is read from the environment so that secrets
are never committed. See backend/.env.example and docs/DEPLOYMENT.md for the
supported variables.

Production safety rules (enforced by :func:`validate_config`):

* ``JWT_SECRET_KEY`` must be explicitly set to a strong, non-placeholder value.
* ``DATABASE_URL`` must explicitly point at PostgreSQL.
* Debug mode, wildcard CORS and privileged self-registration are rejected.
"""

import os
from datetime import timedelta

# Values that are only acceptable while developing locally. Production startup
# refuses to boot when one of these is used as a signing key.
INSECURE_SECRETS = {
    "dev-only-change-me",
    "change-me",
    "changeme",
    "secret",
    "test-secret-key",
    "replace-with-a-long-random-value",
}

DEV_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/mediflow"

DEV_CORS_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:4173,http://127.0.0.1:4173,"
    "http://localhost:8080,http://127.0.0.1:8080"
)

DEV_REGISTRATION_ROLES = "admin,distributor,retailer"
PRODUCTION_ENVIRONMENTS = {"production", "prod"}


def _csv(value, default=""):
    raw = value if value is not None else default
    return [item.strip() for item in raw.split(",") if item.strip()]


def _int_env(name, default):
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError) as error:
        raise RuntimeError(f"{name} must be an integer.") from error


def _bool_env(name, default=False):
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _database_url(value):
    """Normalise a database URL for SQLAlchemy 2.1.

    SQLAlchemy 2.1 defaults bare ``postgresql://`` URLs to the psycopg (v3)
    driver. This project ships psycopg2, so plain URLs are rewritten to
    ``postgresql+psycopg2://`` while explicit driver URLs are left untouched.
    """
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg2://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg2://", 1)
    return value


_ENVIRONMENT = (
    os.environ.get("APP_ENV")
    or os.environ.get("FLASK_ENV")
    or os.environ.get("ENVIRONMENT")
    or "development"
).strip().lower()
_IS_PRODUCTION = _ENVIRONMENT in PRODUCTION_ENVIRONMENTS

_CORS_RAW = os.environ.get("CORS_ALLOWED_ORIGINS") or os.environ.get("CORS_ORIGINS")
_REGISTRATION_RAW = os.environ.get("REGISTRATION_ALLOWED_ROLES")


class Config:
    # Deployment profile. APP_ENV is preferred; FLASK_ENV is kept for parity
    # with the Flask CLI and existing local scripts.
    ENVIRONMENT = _ENVIRONMENT
    IS_PRODUCTION = _IS_PRODUCTION

    # Flask session signing key and JWT fallback. Never keep the dev default in
    # production — validate_config() rejects it.
    SECRET_KEY = (
        os.environ.get("SECRET_KEY")
        or os.environ.get("JWT_SECRET_KEY")
        or "dev-only-change-me"
    )

    # PostgreSQL by default; SQLite is supported so the test-suite can run quickly.
    SQLALCHEMY_DATABASE_URI = _database_url(
        os.environ.get("DATABASE_URL", DEV_DATABASE_URL)
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-only-change-me")
    JWT_ACCESS_TOKEN_HOURS = _int_env("JWT_ACCESS_TOKEN_HOURS", 12)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=JWT_ACCESS_TOKEN_HOURS)
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_TYPE = "Bearer"

    # CORS_ALLOWED_ORIGINS is the documented name; CORS_ORIGINS is accepted for
    # backwards compatibility. Production defaults to no cross-origin access
    # (same-origin requests through the reverse proxy keep working).
    CORS_ALLOWED_ORIGINS = _csv(
        _CORS_RAW, "" if _IS_PRODUCTION else DEV_CORS_ORIGINS
    )
    CORS_ORIGINS = CORS_ALLOWED_ORIGINS

    REGISTRATION_ALLOWED_ROLES = _csv(
        _REGISTRATION_RAW,
        "retailer" if _IS_PRODUCTION else DEV_REGISTRATION_ROLES,
    )

    HOST = os.environ.get("HOST", "127.0.0.1")
    PORT = _int_env("PORT", 5000)

    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
    LOG_FORMAT = os.environ.get("LOG_FORMAT", "text" if not _IS_PRODUCTION else "json")

    # AI assistant. Provider credentials stay server-side; the frontend only
    # ever sees the authenticated /api/ai/* endpoints.
    LLM_PROVIDER = (os.environ.get("LLM_PROVIDER") or "openai").strip().lower()
    LLM_MODEL = (os.environ.get("LLM_MODEL") or "gpt-4o-mini").strip()
    LLM_API_KEY = os.environ.get("LLM_API_KEY") or ""
    LLM_BASE_URL = (
        os.environ.get("LLM_BASE_URL")
        or (
            "http://127.0.0.1:11434"
            if LLM_PROVIDER == "ollama"
            else "https://api.openai.com/v1"
        )
    ).rstrip("/")
    LLM_TIMEOUT = _int_env("LLM_TIMEOUT", 30)
    LLM_MAX_TOKENS = _int_env("LLM_MAX_TOKENS", 800)

    AI_MAX_MESSAGE_LENGTH = _int_env("AI_MAX_MESSAGE_LENGTH", 2000)
    AI_MAX_HISTORY_MESSAGES = _int_env("AI_MAX_HISTORY_MESSAGES", 12)
    AI_MAX_TOOL_ITERATIONS = _int_env("AI_MAX_TOOL_ITERATIONS", 4)
    AI_MAX_TOOL_CALLS_PER_TURN = _int_env("AI_MAX_TOOL_CALLS_PER_TURN", 6)
    AI_MAX_TOOL_RESULT_CHARS = _int_env("AI_MAX_TOOL_RESULT_CHARS", 12000)
    AI_MAX_ANSWER_CHARS = _int_env("AI_MAX_ANSWER_CHARS", 8000)
    AI_RATE_LIMIT_REQUESTS = _int_env("AI_RATE_LIMIT_REQUESTS", 20)
    AI_RATE_LIMIT_WINDOW_SECONDS = _int_env("AI_RATE_LIMIT_WINDOW_SECONDS", 300)

    DEBUG = _bool_env("FLASK_DEBUG", not _IS_PRODUCTION)

    JSON_SORT_KEYS = False


class TestConfig(Config):
    ENVIRONMENT = "testing"
    IS_PRODUCTION = False
    TESTING = True
    SQLALCHEMY_DATABASE_URI = _database_url(os.environ.get("TEST_DATABASE_URL", "sqlite://"))
    JWT_SECRET_KEY = "test-secret-key-that-is-at-least-32-bytes"
    SECRET_KEY = "test-secret-key-that-is-at-least-32-bytes"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    CORS_ORIGINS = CORS_ALLOWED_ORIGINS
    REGISTRATION_ALLOWED_ROLES = ["admin", "distributor", "retailer"]
    SQLALCHEMY_ENGINE_OPTIONS = {}
    DEBUG = False
    LOG_LEVEL = "WARNING"


def is_production(config):
    """Return True when the effective app config is a production profile."""
    environment = str(config.get("ENVIRONMENT") or "").strip().lower()
    return bool(config.get("IS_PRODUCTION")) or environment in PRODUCTION_ENVIRONMENTS


def validate_config(app):
    """Fail fast on unsafe production configuration.

    Development keeps the existing friendly defaults. Production must be
    explicit about its signing keys, database and exposed origins.
    """
    if not is_production(app.config):
        return

    errors = []

    jwt_secret = app.config.get("JWT_SECRET_KEY") or ""
    if (
        len(jwt_secret) < 32
        or jwt_secret in INSECURE_SECRETS
        or jwt_secret.startswith("replace-")
    ):
        errors.append(
            "JWT_SECRET_KEY must be a unique random value of at least 32 characters."
        )

    secret_key = app.config.get("SECRET_KEY") or jwt_secret
    if (
        len(secret_key) < 32
        or secret_key in INSECURE_SECRETS
        or secret_key.startswith("replace-")
    ):
        errors.append(
            "SECRET_KEY must be a unique random value of at least 32 characters."
        )

    database_url = app.config.get("SQLALCHEMY_DATABASE_URI") or ""
    if (
        database_url == _database_url(DEV_DATABASE_URL)
        or not database_url.startswith("postgresql")
    ):
        errors.append(
            "DATABASE_URL must be set explicitly to a PostgreSQL connection URL."
        )

    if app.config.get("DEBUG"):
        errors.append("FLASK_DEBUG must be disabled in production.")

    cors_origins = app.config.get("CORS_ALLOWED_ORIGINS") or []
    if "*" in cors_origins:
        errors.append("CORS_ALLOWED_ORIGINS must not contain the wildcard '*'.")

    roles = app.config.get("REGISTRATION_ALLOWED_ROLES") or []
    privileged = {"admin", "distributor"} & set(roles)
    if privileged:
        errors.append(
            "REGISTRATION_ALLOWED_ROLES must not allow privileged roles in "
            f"production (found: {', '.join(sorted(privileged))})."
        )

    hours = app.config.get("JWT_ACCESS_TOKEN_HOURS")
    if not isinstance(hours, int) or not 1 <= hours <= 720:
        errors.append("JWT_ACCESS_TOKEN_HOURS must be an integer between 1 and 720.")

    port = app.config.get("PORT")
    if not isinstance(port, int) or not 1 <= port <= 65535:
        errors.append("PORT must be an integer between 1 and 65535.")

    # AI assistant. A missing API key does not prevent startup (the chat
    # endpoint returns a safe 503 instead), but an invalid provider or an
    # out-of-range limit is a configuration error.
    provider = str(app.config.get("LLM_PROVIDER") or "").strip().lower()
    if provider not in ("openai", "openai-compatible", "ollama"):
        errors.append(
            "LLM_PROVIDER must be one of: openai, openai-compatible, ollama."
        )
    if not str(app.config.get("LLM_MODEL") or "").strip():
        errors.append("LLM_MODEL must be configured.")

    for key, minimum, maximum in (
        ("LLM_TIMEOUT", 1, 300),
        ("LLM_MAX_TOKENS", 1, 32000),
        ("AI_MAX_MESSAGE_LENGTH", 1, 20000),
        ("AI_MAX_HISTORY_MESSAGES", 1, 100),
        ("AI_MAX_TOOL_ITERATIONS", 1, 10),
        ("AI_MAX_TOOL_CALLS_PER_TURN", 1, 20),
        ("AI_MAX_TOOL_RESULT_CHARS", 100, 100000),
        ("AI_MAX_ANSWER_CHARS", 100, 50000),
        ("AI_RATE_LIMIT_REQUESTS", 0, 1000),
        ("AI_RATE_LIMIT_WINDOW_SECONDS", 1, 86400),
    ):
        value = app.config.get(key)
        if not isinstance(value, int) or not minimum <= value <= maximum:
            errors.append(f"{key} must be an integer between {minimum} and {maximum}.")

    if errors:
        raise RuntimeError(
            "Invalid production configuration:\n - " + "\n - ".join(errors)
        )
