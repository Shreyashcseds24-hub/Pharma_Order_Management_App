"""Application configuration.

Every deployment-specific value is read from the environment so that secrets
are never committed. See backend/.env.example for the supported variables.
"""

import os
from datetime import timedelta


def _csv(value, default=""):
    raw = value if value is not None else default
    return [item.strip() for item in raw.split(",") if item.strip()]


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


class Config:
    # Flask session signing key (also used as a fallback for JWT in development).
    SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET_KEY") or "dev-only-change-me"

    # PostgreSQL by default; SQLite is supported so the test-suite can run quickly.
    SQLALCHEMY_DATABASE_URI = _database_url(
        os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mediflow")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-only-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get("JWT_ACCESS_TOKEN_HOURS", "12"))
    )
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_TYPE = "Bearer"

    CORS_ORIGINS = _csv(
        os.environ.get("CORS_ORIGINS"),
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    )

    REGISTRATION_ALLOWED_ROLES = _csv(
        os.environ.get("REGISTRATION_ALLOWED_ROLES"), "admin,distributor,retailer"
    )

    JSON_SORT_KEYS = False


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = _database_url(os.environ.get("TEST_DATABASE_URL", "sqlite://"))
    JWT_SECRET_KEY = "test-secret-key"
    SECRET_KEY = "test-secret-key"
    REGISTRATION_ALLOWED_ROLES = ["admin", "distributor", "retailer"]
    SQLALCHEMY_ENGINE_OPTIONS = {}
