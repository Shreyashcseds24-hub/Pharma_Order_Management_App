"""Structured application logging.

Uses only the standard library. Production defaults to one JSON object per line
so log collectors can index fields; development keeps a readable text format.

Security: callers must never pass passwords, tokens, JWTs, secrets or full
request bodies to :func:`log_event`. The helpers only record operational
metadata (IDs, statuses, counts, durations).
"""

import json
import logging
import sys
import time
import uuid
from datetime import datetime, timezone

from flask import g, has_request_context, request

# Attributes present on every LogRecord; everything else came from `extra`.
_RESERVED_RECORD_FIELDS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "message",
    "module",
    "msecs",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "taskName",
    "thread",
    "threadName",
}


class JsonFormatter(logging.Formatter):
    """One JSON object per log line, including structured ``extra`` fields."""

    def format(self, record):
        payload = {
            "timestamp": datetime.now(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED_RECORD_FIELDS or key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class RequestIdFilter(logging.Filter):
    """Attach the current request id (when available) to every record."""

    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = (
                getattr(g, "request_id", None) if has_request_context() else None
            )
        return True


def configure_logging(app):
    """Replace Flask's default handler with a structured stdout handler."""
    level_name = str(app.config.get("LOG_LEVEL", "INFO")).upper()
    level = getattr(logging, level_name, logging.INFO)
    log_format = str(app.config.get("LOG_FORMAT", "text")).lower()

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    if log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
            )
        )

    for existing in list(app.logger.handlers):
        app.logger.removeHandler(existing)
    app.logger.addHandler(handler)
    app.logger.setLevel(level)
    app.logger.propagate = False


def register_request_logging(app):
    """Log API request completion with method, path, status and duration."""

    @app.before_request
    def _start_request_timer():
        g.request_id = uuid.uuid4().hex
        g.request_started_at = time.perf_counter()

    @app.after_request
    def _log_request(response):
        request_id = getattr(g, "request_id", uuid.uuid4().hex)
        response.headers.setdefault("X-Request-ID", request_id)
        started = getattr(g, "request_started_at", None)
        duration_ms = (
            round((time.perf_counter() - started) * 1000, 2)
            if started is not None
            else None
        )
        # Health probes are frequent; failures are logged by the endpoint itself.
        if request.path.startswith("/api/") and not request.path.startswith(
            "/api/health"
        ):
            user = getattr(g, "current_user", None)
            log_event(
                app.logger,
                "http.request",
                method=request.method,
                path=request.path,
                status=response.status_code,
                duration_ms=duration_ms,
                user_id=getattr(user, "id", None),
                role=getattr(getattr(user, "role", None), "name", None),
            )
        return response


def log_event(logger, event, level=logging.INFO, **fields):
    """Emit a structured event without ever including request bodies/secrets."""
    logger.log(level, event, extra={"event": event, **fields})
