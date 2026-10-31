"""Uniform JSON error handling for the API.

The frontend normalises errors by reading `data.message` (or `data.error`), so
every error response is `{"message": "...", "errors": {...}}`.

Production responses never include exception messages or stack traces. Errors
are logged as structured events (without request bodies or credentials) so
operators can diagnose them from container logs.
"""

import logging

from flask import current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .extensions import db
from .logging_config import log_event


class ApiError(Exception):
    def __init__(self, message, status=400, errors=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.errors = errors


def _payload(message, status, errors=None):
    body = {"message": message, "status": status}
    if errors:
        body["errors"] = errors
    return jsonify(body), status


def _log_api_error(status, message):
    log_event(
        current_app.logger,
        "api.error",
        level=logging.ERROR if status >= 500 else logging.WARNING,
        status=status,
        method=request.method,
        path=request.path,
        reason=message,
    )


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        db.session.rollback()
        _log_api_error(error.status, error.message)
        return _payload(error.message, error.status, error.errors)

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        if error.code and error.code >= 500:
            db.session.rollback()
        messages = {
            400: "The request could not be understood.",
            401: "Authentication is required.",
            403: "You do not have permission to perform this action.",
            404: "The requested resource was not found.",
            405: "This method is not allowed.",
            413: "The request payload is too large.",
            415: "Unsupported content type.",
            422: "The submitted data is invalid.",
        }
        message = messages.get(error.code, error.description or "Request failed.")
        _log_api_error(error.code or 500, message)
        return _payload(message, error.code or 500)

    @app.errorhandler(SQLAlchemyError)
    def handle_database_error(error):
        db.session.rollback()
        # Log the exception type and traceback only. SQLAlchemy's URL repr hides
        # passwords, and request credentials are never passed to the logger.
        log_event(
            app.logger,
            "database.error",
            level=logging.ERROR,
            error_type=type(error).__name__,
        )
        app.logger.debug("database.exception", exc_info=True)
        if app.config.get("PROPAGATE_EXCEPTIONS"):
            raise error
        return _payload("A database error occurred. Please try again.", 500)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        db.session.rollback()
        log_event(
            app.logger,
            "application.error",
            level=logging.ERROR,
            error_type=type(error).__name__,
        )
        app.logger.exception("Unhandled error")
        if app.config.get("PROPAGATE_EXCEPTIONS"):
            raise error
        return _payload("An unexpected server error occurred.", 500)
