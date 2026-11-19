"""Read-only business tools exposed to the LLM.

Every tool:

* is listed explicitly in :data:`TOOL_SCHEMAS` (the model cannot invent tools);
* validates its arguments with bounded types and ranges;
* uses SQLAlchemy models/analytics helpers only (no raw SQL);
* applies the same retailer scoping as the HTTP analytics endpoints;
* returns compact JSON-serialisable data.

There are intentionally no create/update/delete tools.
"""

from __future__ import annotations

import re
from datetime import date

from ..models import Medicine
from ..utils import json_date
from . import analytics_data

MAX_ROWS = 50


class ToolError(Exception):
    """Base class for tool execution errors."""


class ToolNotFoundError(ToolError):
    pass


class ToolValidationError(ToolError):
    pass


def _reject_unknown(arguments, allowed):
    unknown = sorted(set(arguments) - set(allowed))
    if unknown:
        raise ToolValidationError(
            f"Unknown argument(s): {', '.join(unknown)}. Allowed: {', '.join(sorted(allowed)) or 'none'}."
        )


def _int_arg(arguments, name, default, minimum, maximum):
    value = arguments.get(name, default)
    if isinstance(value, bool):
        raise ToolValidationError(f"{name} must be a whole number.")
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ToolValidationError(f"{name} must be a whole number.")
    if value < minimum or value > maximum:
        raise ToolValidationError(f"{name} must be between {minimum} and {maximum}.")
    return value


def _bool_arg(arguments, name, default=False):
    value = arguments.get(name, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lower() in ("true", "false"):
        return value.strip().lower() == "true"
    raise ToolValidationError(f"{name} must be a boolean.")


def _string_arg(arguments, name, *, required=False, max_length=80):
    value = arguments.get(name)
    if value in (None, ""):
        if required:
            raise ToolValidationError(f"{name} is required.")
        return None
    if not isinstance(value, str):
        raise ToolValidationError(f"{name} must be a string.")
    value = value.strip()
    if not value:
        if required:
            raise ToolValidationError(f"{name} is required.")
        return None
    if len(value) > max_length:
        raise ToolValidationError(f"{name} must be at most {max_length} characters.")
    return value


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------
def get_inventory_summary(user, arguments):
    _reject_unknown(arguments, set())
    return analytics_data.inventory_summary()


def get_low_stock_medicines(user, arguments):
    _reject_unknown(arguments, {"limit"})
    limit = _int_arg(arguments, "limit", 10, 1, MAX_ROWS)
    rows = []
    for medicine, available in analytics_data.lower_stock_medicines()[:limit]:
        rows.append(
            {
                "medicineId": medicine.id,
                "name": f"{medicine.name} {medicine.strength}",
                "brand": medicine.brand,
                "available": available,
                "reorderLevel": medicine.reorder_level,
                "shortfall": max(0, medicine.reorder_level - available),
                "status": "Out of stock" if available <= 0 else "Low stock",
            }
        )
    return {"count": len(rows), "medicines": rows}


def get_expiring_medicines(user, arguments):
    _reject_unknown(arguments, {"days", "limit"})
    days = _int_arg(arguments, "days", 30, 1, 365)
    limit = _int_arg(arguments, "limit", 20, 1, 100)
    rows = analytics_data.expiry_risk(days)[:limit]
    expired = [row for row in rows if row["daysLeft"] < 0]
    return {
        "days": days,
        "count": len(rows),
        "expiredCount": len(expired),
        "batches": rows,
    }


def get_medicine_details(user, arguments):
    _reject_unknown(arguments, {"medicine_id", "include_batches"})
    medicine_id = _string_arg(arguments, "medicine_id", required=True, max_length=20)
    include_batches = _bool_arg(arguments, "include_batches", True)

    medicine = Medicine.query.get(medicine_id)
    if medicine is None or not medicine.is_active:
        raise ToolValidationError("No active medicine was found with that ID.")

    available = analytics_data.total_available(medicine)
    payload = {
        "medicineId": medicine.id,
        "name": medicine.name,
        "brand": medicine.brand,
        "strength": medicine.strength,
        "dosageForm": medicine.dosage_form,
        "packSize": medicine.pack_size,
        "category": medicine.category.name if medicine.category else "",
        "supplier": medicine.supplier.name if medicine.supplier else "Unassigned",
        "unitPrice": float(medicine.unit_price),
        "reorderLevel": medicine.reorder_level,
        "requiresPrescription": medicine.requires_prescription,
        "availableQuantity": available,
        "stockStatus": (
            "Out of stock"
            if available <= 0
            else "Low stock"
            if available <= medicine.reorder_level
            else "In stock"
        ),
    }
    if include_batches:
        batches = sorted(medicine.batches, key=lambda batch: batch.expiry_date)
        payload["batches"] = [
            {
                "batchId": batch.id,
                "batchNumber": batch.batch_number,
                "expiryDate": json_date(batch.expiry_date),
                "daysToExpiry": (batch.expiry_date - date.today()).days,
                "quantity": batch.inventory.quantity if batch.inventory else 0,
                "costPrice": float(batch.cost_price),
                "warehouse": batch.warehouse,
            }
            for batch in batches[:30]
        ]
        payload["batchCount"] = len(batches)
    return payload


def get_order_summary(user, arguments):
    _reject_unknown(arguments, {"days", "status"})
    days = _int_arg(arguments, "days", 30, 1, 365)
    status = _string_arg(arguments, "status", max_length=20)
    if status and status not in analytics_data.REPORT_STATUSES:
        raise ToolValidationError(
            "status must be one of: " + ", ".join(analytics_data.REPORT_STATUSES)
        )
    return analytics_data.order_summary(user, days=days, status=status)


def get_sales_summary(user, arguments):
    _reject_unknown(arguments, {"days", "compare_previous"})
    days = _int_arg(arguments, "days", 30, 1, 365)
    compare_previous = _bool_arg(arguments, "compare_previous", False)
    result = analytics_data.sales_summary(
        user, days=days, compare_previous=compare_previous
    )
    # The daily series is useful in charts but unnecessarily large in a prompt.
    result.pop("daily", None)
    return result


def get_top_selling_medicines(user, arguments):
    _reject_unknown(arguments, {"days", "limit"})
    days = _int_arg(arguments, "days", 30, 1, 365)
    limit = _int_arg(arguments, "limit", 10, 1, MAX_ROWS)
    rows = analytics_data.top_selling_medicines(user, days=days, limit=limit)
    return {"days": days, "count": len(rows), "medicines": rows}


def get_pending_orders(user, arguments):
    _reject_unknown(arguments, {"limit"})
    limit = _int_arg(arguments, "limit", 10, 1, MAX_ROWS)
    rows = analytics_data.pending_orders(user, limit=limit)
    return {"count": len(rows), "orders": rows}


def get_inventory_recommendations(user, arguments):
    _reject_unknown(arguments, {"horizon", "limit"})
    horizon = _int_arg(arguments, "horizon", 14, 1, 90)
    limit = _int_arg(arguments, "limit", 10, 1, MAX_ROWS)
    rows = analytics_data.recommendations(user, horizon)[:limit]
    cleaned = [
        {key: value for key, value in row.items() if not key.startswith("_")}
        for row in rows
    ]
    return {"horizonDays": horizon, "count": len(cleaned), "recommendations": cleaned}


TOOL_HANDLERS = {
    "get_inventory_summary": get_inventory_summary,
    "get_low_stock_medicines": get_low_stock_medicines,
    "get_expiring_medicines": get_expiring_medicines,
    "get_medicine_details": get_medicine_details,
    "get_order_summary": get_order_summary,
    "get_sales_summary": get_sales_summary,
    "get_top_selling_medicines": get_top_selling_medicines,
    "get_pending_orders": get_pending_orders,
    "get_inventory_recommendations": get_inventory_recommendations,
}

TOOL_LABELS = {
    "get_inventory_summary": "Inventory summary",
    "get_low_stock_medicines": "Low-stock medicines",
    "get_expiring_medicines": "Expiry risk (batch inventory)",
    "get_medicine_details": "Medicine catalog and batches",
    "get_order_summary": "Orders",
    "get_sales_summary": "Sales analytics",
    "get_top_selling_medicines": "Top-selling medicines",
    "get_pending_orders": "Pending orders",
    "get_inventory_recommendations": "Replenishment recommendations",
}

TOOL_NAMES = tuple(TOOL_HANDLERS)


def _schema(name, description, properties=None, required=None):
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties or {},
                "required": required or [],
                "additionalProperties": False,
            },
        },
    }


TOOL_SCHEMAS = [
    _schema(
        "get_inventory_summary",
        "Aggregate inventory KPIs: active medicines, batch count, usable units, "
        "low/out-of-stock counts, near-expiry batches and inventory value.",
    ),
    _schema(
        "get_low_stock_medicines",
        "List active medicines whose usable stock is at or below the reorder level.",
        {"limit": {"type": "integer", "minimum": 1, "maximum": MAX_ROWS}},
    ),
    _schema(
        "get_expiring_medicines",
        "List batches expiring within a number of days (includes already expired batches).",
        {
            "days": {"type": "integer", "minimum": 1, "maximum": 365},
            "limit": {"type": "integer", "minimum": 1, "maximum": 100},
        },
    ),
    _schema(
        "get_medicine_details",
        "Get catalog details and batches for one medicine by its business ID.",
        {
            "medicine_id": {"type": "string", "maxLength": 20},
            "include_batches": {"type": "boolean"},
        },
        ["medicine_id"],
    ),
    _schema(
        "get_order_summary",
        "Summarise orders in a recent period, optionally filtered by status. "
        "Retailers only see their own orders.",
        {
            "days": {"type": "integer", "minimum": 1, "maximum": 365},
            "status": {
                "type": "string",
                "enum": list(analytics_data.REPORT_STATUSES),
            },
        },
    ),
    _schema(
        "get_sales_summary",
        "Revenue, order and unit totals for a recent period, optionally compared "
        "with the immediately preceding period. Retailers only see their own sales.",
        {
            "days": {"type": "integer", "minimum": 1, "maximum": 365},
            "compare_previous": {"type": "boolean"},
        },
    ),
    _schema(
        "get_top_selling_medicines",
        "Rank fulfilled medicines by units sold in a recent period. Retailers only "
        "see their own sales.",
        {
            "days": {"type": "integer", "minimum": 1, "maximum": 365},
            "limit": {"type": "integer", "minimum": 1, "maximum": MAX_ROWS},
        },
    ),
    _schema(
        "get_pending_orders",
        "List orders currently waiting for approval. Retailers only see their own orders.",
        {"limit": {"type": "integer", "minimum": 1, "maximum": MAX_ROWS}},
    ),
    _schema(
        "get_inventory_recommendations",
        "Replenishment suggestions based on recent demand and the planning horizon.",
        {
            "horizon": {"type": "integer", "minimum": 1, "maximum": 90},
            "limit": {"type": "integer", "minimum": 1, "maximum": MAX_ROWS},
        },
    ),
]


def execute_tool(name, arguments, user):
    """Execute a whitelisted read-only tool.

    Raises :class:`ToolNotFoundError` for unknown tools and
    :class:`ToolValidationError` for invalid arguments. The orchestrator turns
    both into tool-result errors so the model can recover without crashing the
    request.
    """
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ToolNotFoundError(f"Unknown tool: {name}")
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        raise ToolValidationError("Tool arguments must be an object.")
    return handler(user, arguments)


def tool_label(name):
    return TOOL_LABELS.get(name, name)


def deterministic_tool_plan(message):
    """Choose a small, safe tool set when a model does not support tool calling.

    This is only used as a fallback. It never executes arbitrary tools and never
    accepts tool names from the model or the user.
    """
    text = (message or "").lower()
    days_match = re.search(r"(\d{1,3})\s*day", text)
    days = 30
    if days_match:
        days = max(1, min(int(days_match.group(1)), 365))

    plan = []

    def add(name, arguments=None):
        if name not in TOOL_HANDLERS:
            return
        if any(item["name"] == name for item in plan):
            return
        plan.append({"name": name, "arguments": arguments or {}})

    wants_low_stock = any(
        phrase in text
        for phrase in ("low stock", "low-stock", "running low", "restock", "reorder", "out of stock")
    )
    wants_expiry = "expir" in text
    wants_top_selling = any(
        phrase in text for phrase in ("top selling", "top-selling", "best selling", "best-selling", "top seller")
    )
    wants_sales = any(phrase in text for phrase in ("sales", "revenue", "turnover", "sold"))
    wants_pending = any(phrase in text for phrase in ("pending", "open order", "awaiting approval"))
    wants_orders = "order" in text
    wants_inventory = any(phrase in text for phrase in ("inventory", "stock", "warehouse"))
    wants_recommendations = any(
        phrase in text for phrase in ("recommend", "should i order", "purchase", "replenish")
    )

    if wants_low_stock:
        add("get_low_stock_medicines", {"limit": 10})
    if wants_recommendations:
        add("get_inventory_recommendations", {"horizon": 14, "limit": 10})
    if wants_expiry:
        add("get_expiring_medicines", {"days": days, "limit": 20})
    if wants_top_selling:
        add("get_top_selling_medicines", {"days": days, "limit": 10})
    if wants_sales:
        add(
            "get_sales_summary",
            {"days": days, "compare_previous": "compare" in text or "last month" in text},
        )
    if wants_pending:
        add("get_pending_orders", {"limit": 10})
    if wants_orders and not wants_pending:
        add("get_order_summary", {"days": days})
    if wants_inventory:
        add("get_inventory_summary")

    if not plan:
        add("get_inventory_summary")
        add("get_low_stock_medicines", {"limit": 10})
        add("get_pending_orders", {"limit": 10})
        add("get_sales_summary", {"days": 30})

    return plan[:6]


__all__ = [
    "TOOL_HANDLERS",
    "TOOL_LABELS",
    "TOOL_NAMES",
    "TOOL_SCHEMAS",
    "ToolError",
    "ToolNotFoundError",
    "ToolValidationError",
    "deterministic_tool_plan",
    "execute_tool",
    "tool_label",
]
