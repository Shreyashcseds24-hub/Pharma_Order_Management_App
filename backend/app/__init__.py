from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before importing the Config class (which reads env vars).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from flask import Flask, jsonify  # noqa: E402

from .config import Config  # noqa: E402
from .errors import register_error_handlers  # noqa: E402
from .extensions import cors, db, jwt, migrate  # noqa: E402
from .models import RevokedToken  # noqa: E402


def create_app(config_object=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    if config_object is not None:
        if isinstance(config_object, dict):
            app.config.update(config_object)
        else:
            app.config.from_object(config_object)

    app.json.sort_keys = False

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "mediflow-api",
                "time": datetime.now(timezone.utc).isoformat(),
            }
        )

    register_error_handlers(app)

    from .cli import register_cli

    register_cli(app)

    return app
