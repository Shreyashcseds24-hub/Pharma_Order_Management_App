from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before importing the Config class (which reads env vars).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import logging  # noqa: E402

from flask import Flask, jsonify  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402

from .config import Config, is_production, validate_config  # noqa: E402
from .errors import register_error_handlers  # noqa: E402
from .extensions import cors, db, jwt, migrate  # noqa: E402
from .logging_config import (  # noqa: E402
    configure_logging,
    log_event,
    register_request_logging,
)
from .models import RevokedToken  # noqa: E402

SERVICE_NAME = "mediflow-api"


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _database_target(app):
    """Describe the DB target for startup logs without credentials."""
    try:
        url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
        return {
            "driver": url.get_backend_name(),
            "host": url.host,
            "port": url.port,
            "database": url.database,
        }
    except Exception:  # pragma: no cover - defensive, never log the raw URL
        return {"driver": "unknown"}


def create_app(config_object=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    if config_object is not None:
        if isinstance(config_object, dict):
            app.config.update(config_object)
        else:
            app.config.from_object(config_object)

    validate_config(app)
    if is_production(app.config):
        app.config["DEBUG"] = False
        app.config["TESTING"] = False
        app.config["PROPAGATE_EXCEPTIONS"] = False

    app.json.sort_keys = False
    configure_logging(app)
    register_request_logging(app)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": app.config.get("CORS_ALLOWED_ORIGINS") or [],
            }
        },
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        expose_headers=["X-Request-ID"],
    )

    @jwt.token_in_blocklist_loader
    def token_is_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get("jti")
        return bool(jti and RevokedToken.query.filter_by(jti=jti).first())

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({"message": "Authentication is required.", "status": 401}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({"message": "Your session token is invalid. Please sign in again.", "status": 401}), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify({"message": "Your session has expired. Please sign in again.", "status": 401}), 401

    @jwt.revoked_token_loader
    def revoked_token(jwt_header, jwt_payload):
        return jsonify({"message": "Your session has been revoked. Please sign in again.", "status": 401}), 401

    from .blueprints import (
        analytics_bp,
        auth_bp,
        inventory_bp,
        invoices_bp,
        medicines_bp,
        orders_bp,
    )
    from .blueprints.orders import retailers_bp

    for blueprint, prefix in (
        (auth_bp, "/api/auth"),
        (medicines_bp, "/api/medicines"),
        (inventory_bp, "/api/inventory"),
        (orders_bp, "/api/orders"),
        (retailers_bp, "/api/retailers"),
        (invoices_bp, "/api/invoices"),
        (analytics_bp, "/api/analytics"),
    ):
        app.register_blueprint(blueprint, url_prefix=prefix)

    @app.get("/api/health")
    @app.get("/api/health/live")
    def health():
        """Liveness: the process is running and able to serve requests."""
        return jsonify(
            {
                "status": "ok",
                "service": SERVICE_NAME,
                "time": _utc_now(),
            }
        )

    @app.get("/api/health/ready")
    def readiness():
        """Readiness: the process can reach its database."""
        try:
            db.session.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            db.session.rollback()
            log_event(
                app.logger,
                "health.database_unavailable",
                level=logging.ERROR,
                error_type=type(error).__name__,
            )
            return (
                jsonify(
                    {
                        "status": "unavailable",
                        "service": SERVICE_NAME,
                        "database": "unavailable",
                        "time": _utc_now(),
                    }
                ),
                503,
            )
        return jsonify(
            {
                "status": "ready",
                "service": SERVICE_NAME,
                "database": "ok",
                "time": _utc_now(),
            }
        )

    register_error_handlers(app)

    from .cli import register_cli

    register_cli(app)

    log_event(
        app.logger,
        "application.startup",
        environment=app.config.get("ENVIRONMENT"),
        debug=bool(app.config.get("DEBUG")),
        database=_database_target(app),
        cors_origin_count=len(app.config.get("CORS_ALLOWED_ORIGINS") or []),
        registration_roles=app.config.get("REGISTRATION_ALLOWED_ROLES"),
        jwt_expiry_hours=app.config.get("JWT_ACCESS_TOKEN_HOURS"),
    )

    return app
