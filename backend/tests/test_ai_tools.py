"""Read-only AI tool tests against the seeded SQLite test database."""

import pytest

from app.models import User
from app.services.ai_assistant import is_medical_question, is_small_talk
from app.services.ai_tools import (
    ToolNotFoundError,
    ToolValidationError,
    deterministic_tool_plan,
    execute_tool,
)

ADMIN_EMAIL = "admin@test.dev"
RETAILER_NOVA = "retailer@test.dev"  # RTL-02
RETAILER_APEX = "retailer2@test.dev"  # RTL-01


def _run(app, email, name, arguments):
    with app.app_context():
        user = User.query.filter_by(email=email).one()
        return execute_tool(name, arguments, user)


def test_inventory_summary_uses_seeded_database(app, client):
    data = _run(app, ADMIN_EMAIL, "get_inventory_summary", {})
    assert data["activeMedicines"] == 3
    assert data["batchCount"] == 5
    # Ibuprofen's only batch is expired, so it is counted as out of stock
    # rather than low stock; Amoxicillin is the low-stock medicine.
    assert data["lowStockMedicines"] == 1
    assert data["outOfStockMedicines"] == 1
    assert data["nearExpiryBatches90d"] == 2
    assert data["expiredUnits"] == 100
    assert data["expiredValue"] == 400.0


def test_low_stock_tool_returns_shortfalls(app, client):
    data = _run(app, ADMIN_EMAIL, "get_low_stock_medicines", {"limit": 10})
    names = {row["name"] for row in data["medicines"]}
    assert names == {"Amoxicillin 500 mg", "Ibuprofen 400 mg"}
    amoxicillin = next(row for row in data["medicines"] if row["name"].startswith("Amoxicillin"))
    assert amoxicillin["available"] == 5
    assert amoxicillin["shortfall"] == 5


def test_expiring_tool_includes_expired_and_limits_window(app, client):
    data = _run(app, ADMIN_EMAIL, "get_expiring_medicines", {"days": 30, "limit": 20})
    batch_ids = {row["id"] for row in data["batches"]}
    assert {"BATCH-1", "BATCH-3", "BATCH-5"}.issubset(batch_ids)
    assert data["expiredCount"] == 1


def test_medicine_details_tool(app, client):
    data = _run(
        app,
        ADMIN_EMAIL,
        "get_medicine_details",
        {"medicine_id": "MED-001", "include_batches": True},
    )
    assert data["name"] == "Paracetamol"
    assert data["availableQuantity"] == 150
    assert data["batchCount"] == 3


def test_order_summary_is_retailer_scoped(app, client):
    admin = _run(app, ADMIN_EMAIL, "get_order_summary", {"days": 30})
    assert admin["orderCount"] == 2

    apex = _run(app, RETAILER_APEX, "get_order_summary", {"days": 30})
    assert [row["id"] for row in apex["orders"]] == ["ORD-100"]

    nova = _run(app, RETAILER_NOVA, "get_order_summary", {"days": 30})
    assert [row["id"] for row in nova["orders"]] == ["ORD-101"]


def test_sales_summary_is_retailer_scoped(app, client):
    admin = _run(app, ADMIN_EMAIL, "get_sales_summary", {"days": 30})
    assert admin["orders"] == 2
    assert admin["units"] == 40
    assert admin["revenue"] == 500.0

    nova = _run(app, RETAILER_NOVA, "get_sales_summary", {"days": 30})
    assert nova["orders"] == 1
    assert nova["units"] == 10
    assert nova["revenue"] == 100.0


def test_top_selling_uses_fulfilled_orders(app, client):
    data = _run(app, ADMIN_EMAIL, "get_top_selling_medicines", {"days": 30, "limit": 10})
    assert data["medicines"][0]["name"] == "Paracetamol 500 mg"
    assert data["medicines"][0]["units"] == 20

    nova = _run(app, RETAILER_NOVA, "get_top_selling_medicines", {"days": 30})
    assert nova["medicines"] == []


def test_pending_orders_are_retailer_scoped(app, client):
    admin = _run(app, ADMIN_EMAIL, "get_pending_orders", {"limit": 10})
    assert [row["id"] for row in admin["orders"]] == ["ORD-101"]

    nova = _run(app, RETAILER_NOVA, "get_pending_orders", {"limit": 10})
    assert [row["id"] for row in nova["orders"]] == ["ORD-101"]

    apex = _run(app, RETAILER_APEX, "get_pending_orders", {"limit": 10})
    assert apex["orders"] == []


def test_recommendations_tool_returns_clean_rows(app, client):
    data = _run(
        app, ADMIN_EMAIL, "get_inventory_recommendations", {"horizon": 14, "limit": 10}
    )
    assert data["horizonDays"] == 14
    assert data["recommendations"]
    assert all("_daysCover" not in row for row in data["recommendations"])


@pytest.mark.parametrize(
    "name, arguments",
    [
        ("run_sql", {"query": "DROP TABLE users"}),
        ("get_inventory_summary", {"unexpected": True}),
        ("get_low_stock_medicines", {"limit": 0}),
        ("get_expiring_medicines", {"days": 999}),
        ("get_medicine_details", {}),
        ("get_medicine_details", {"medicine_id": "MED-999"}),
        ("get_order_summary", {"status": "Unknown"}),
    ],
)
def test_tool_validation_rejects_unknown_tools_and_bad_arguments(app, client, name, arguments):
    with app.app_context():
        user = User.query.filter_by(email=ADMIN_EMAIL).one()
        with pytest.raises((ToolNotFoundError, ToolValidationError)):
            execute_tool(name, arguments, user)


def test_medical_question_detection():
    assert is_medical_question("What dosage should I take for a headache?")
    assert is_medical_question("Can you diagnose this rash?")
    assert not is_medical_question("Which medicines are expiring within 30 days?")
    assert not is_medical_question("Summarize this month's orders.")


def test_small_talk_detection():
    assert is_small_talk("Hello")
    assert is_small_talk("thanks!")
    assert not is_small_talk("How is my inventory?")


def test_deterministic_plan_selects_relevant_tools():
    expiry = deterministic_tool_plan("Which medicines expire within 30 days?")
    assert expiry[0]["name"] == "get_expiring_medicines"
    assert expiry[0]["arguments"]["days"] == 30

    inventory = deterministic_tool_plan("Analyze my inventory.")
    assert inventory[0]["name"] == "get_inventory_summary"

    low = deterministic_tool_plan("Identify low-stock medicines.")
    assert any(item["name"] == "get_low_stock_medicines" for item in low)

    sales = deterministic_tool_plan("Analyze sales performance.")
    assert any(item["name"] == "get_sales_summary" for item in sales)
