"""Uniform JSON error handling for the API.

The frontend normalises errors by reading `data.message` (or `data.error`), so
every error response is `{"message": "...", "errors": {...}}`.
"""

from flask import jsonify
from werkzeug.exceptions import HTTPException

from .extensions import db


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


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        db.session.rollback()
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
        return _payload(message, error.code or 500)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        db.session.rollback()
        app.logger.exception("Unhandled error: %s", error)
        if app.config.get("PROPAGATE_EXCEPTIONS"):
            raise error
        return _payload("An unexpected server error occurred.", 500)
