"""Shared helpers: dates, validation, business IDs and audit records."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from .errors import ApiError
from .extensions import db
from .models import ActivityLog, Counter, StockMovement


def parse_date(value, field, *, required=True, allow_past=True):
    if value in (None, ""):
        if required:
            raise ApiError(f"{field} is required.", 422, {field: f"{field} is required."})
        return None
    if isinstance(value, datetime):
        parsed = value.date()
    elif isinstance(value, date):
        parsed = value
    else:
        try:
            parsed = date.fromisoformat(str(value)[:10])
        except ValueError:
            raise ApiError(
                f"{field} must be a valid date (YYYY-MM-DD).",
                422,
                {field: "Use the YYYY-MM-DD format."},
            )
    if not allow_past and parsed <= date.today():
        raise ApiError(
            f"{field} must be in the future.",
            422,
            {field: "Choose a future date."},
        )
    return parsed


def parse_int(value, field, *, minimum=None, maximum=None, default=None):
    if value in (None, ""):
        if default is not None:
            return default
        raise ApiError(f"{field} is required.", 422, {field: f"{field} is required."})
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ApiError(
            f"{field} must be a whole number.",
            422,
            {field: "Enter a whole number."},
        )
    if minimum is not None and parsed < minimum:
        raise ApiError(
            f"{field} must be at least {minimum}.",
            422,
            {field: f"Enter a value of at least {minimum}."},
        )
    if maximum is not None and parsed > maximum:
        raise ApiError(
            f"{field} must be at most {maximum}.",
            422,
            {field: f"Enter a value of at most {maximum}."},
        )
    return parsed


def parse_decimal(value, field, *, minimum=None, default=None):
    if value in (None, ""):
        if default is not None:
            return Decimal(str(default))
        raise ApiError(f"{field} is required.", 422, {field: f"{field} is required."})
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ApiError(
            f"{field} must be a number.",
            422,
            {field: "Enter a valid number."},
        )
    if parsed.is_nan() or parsed.is_infinite():
        raise ApiError(f"{field} must be a number.", 422, {field: "Enter a valid number."})
    if minimum is not None and parsed < Decimal(str(minimum)):
        raise ApiError(
            f"{field} must be at least {minimum}.",
            422,
            {field: f"Enter a value of at least {minimum}."},
        )
    return parsed


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def json_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def json_datetime(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def next_counter(name, default=0, step=1):
    """Atomically allocate the next value for a named counter.

    On PostgreSQL the row is locked for the duration of the transaction, which
    prevents two concurrent checkouts from receiving the same business ID.
    """
    counter = db.session.get(Counter, name, with_for_update=True)
    if counter is None:
        counter = Counter(name=name, value=default)
        db.session.add(counter)
        db.session.flush()
    counter.value += step
    db.session.flush()
    return counter.value


def next_business_id(name, prefix, default, width=0):
    value = next_counter(name, default)
    number = str(value).zfill(width) if width else str(value)
    return f"{prefix}-{number}"


def add_activity(activity_type, title, detail, actor, when=None):
    entry = ActivityLog(
        id=next_business_id("activity", "ACT", 100),
        type=activity_type,
        title=title,
        detail=detail,
        time=when or date.today(),
        actor=actor or "System",
    )
    db.session.add(entry)
    return entry


def add_movement(medicine, batch, movement_type, quantity, reference, user, when=None):
    movement = StockMovement(
        id=next_business_id("movement", "MOV", 100),
        date=when or date.today(),
        medicine_id=medicine.id if medicine else None,
        batch_id=batch.id if batch else None,
        type=movement_type,
        quantity=quantity,
        reference=reference,
        user=user or "System",
    )
    db.session.add(movement)
    return movement


def invoice_due_date(invoice_date, days=30):
    return invoice_date + timedelta(days=days)


def day_bounds(days_back):
    """Return the inclusive list of dates for the last `days_back` days."""
    today = date.today()
    return [today - timedelta(days=offset) for offset in range(days_back - 1, -1, -1)]


def start_of_week(value):
    return value - timedelta(days=value.weekday())


def safe_ratio(numerator, denominator, fallback=0.0):
    if not denominator:
        return fallback
    return numerator / denominator


def initials_for(name):
    parts = [part for part in str(name or "").strip().split() if part]
    return "".join(part[0] for part in parts[:2]).upper() or "U"
