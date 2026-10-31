from datetime import date, timedelta

import pytest


def test_list_medicines_returns_frontend_contract(client, admin_headers):
    response = client.get("/api/medicines", headers=admin_headers)

    assert response.status_code == 200
    medicines = response.get_json()
    assert len(medicines) == 3
    by_id = {medicine["id"]: medicine for medicine in medicines}
    paracetamol = by_id["MED-001"]
    assert paracetamol["name"] == "Paracetamol"
    assert paracetamol["availableQuantity"] == 150
    assert paracetamol["availability"] == "In stock"
    assert paracetamol["primaryExpiryDate"]
    assert len(paracetamol["batches"]) == 3
    assert by_id["MED-002"]["availability"] == "Low stock"


def test_create_medicine_with_opening_batch(client, distributor_headers):
    response = client.post(
        "/api/medicines",
        headers=distributor_headers,
        json={
            "name": "Cetirizine",
            "brand": "Zyrtec",
            "strength": "10 mg",
            "dosageForm": "Tablet",
            "packSize": "10 tablets x 10 strips",
            "category": "Antihistamine",
            "unitPrice": 3.5,
            "reorderLevel": 20,
            "supplier": "Vertex Generics",
            "batchNumber": "MF900",
            "expiryDate": (date.today() + timedelta(days=365)).isoformat(),
            "quantity": 25,
            "costPrice": 2.5,
        },
    )

    assert response.status_code == 201
    medicine = response.get_json()
    assert medicine["id"] == "MED-004"
    assert medicine["availableQuantity"] == 25
    assert medicine["batches"][0]["batchNumber"] == "MF900"

    movements = client.get("/api/inventory/movements", headers=distributor_headers)
    assert any(
        movement["type"] == "Inbound"
        and movement["medicineId"] == "MED-004"
        and movement["quantity"] == 25
        for movement in movements.get_json()
    )


def test_create_medicine_validates_fields(client, admin_headers):
    response = client.post(
        "/api/medicines",
        headers=admin_headers,
        json={"name": "", "brand": "", "unitPrice": 0},
    )

    assert response.status_code == 422
    assert "name" in response.get_json()["errors"]

    price = client.post(
        "/api/medicines",
        headers=admin_headers,
        json={
            "name": "Valid name",
            "brand": "Valid brand",
            "strength": "1 mg",
            "packSize": "1 strip",
            "unitPrice": 0,
        },
    )
    assert price.status_code == 422
    assert "unitPrice" in price.get_json()["errors"]


def test_update_medicine_persists(client, admin_headers):
    response = client.put(
        "/api/medicines/MED-001",
        headers=admin_headers,
        json={"name": "Paracetamol Extra", "unitPrice": 12.5, "reorderLevel": 120},
    )

    assert response.status_code == 200
    assert response.get_json()["unitPrice"] == 12.5

    fetched = client.get("/api/medicines/MED-001", headers=admin_headers).get_json()
    assert fetched["name"] == "Paracetamol Extra"
    assert fetched["reorderLevel"] == 120


def test_delete_medicine_is_a_soft_delete(client, admin_headers):
    assert (
        client.delete("/api/medicines/MED-003", headers=admin_headers).status_code
        == 200
    )

    medicines = client.get("/api/medicines", headers=admin_headers).get_json()
    assert "MED-003" not in {medicine["id"] for medicine in medicines}
    assert (
        client.get("/api/medicines/MED-003", headers=admin_headers).status_code == 404
    )

    orders = client.get("/api/orders", headers=admin_headers).get_json()
    assert any(
        item["medicineId"] == "MED-003"
        for order in orders
        for item in order["items"]
    ) is False
    # Historical order lines remain readable even though the catalog entry is hidden.
    historical = client.get("/api/orders/ORD-100", headers=admin_headers).get_json()
    assert {item["medicineId"] for item in historical["items"]} == {"MED-001", "MED-002"}


def test_retailer_cannot_write_catalog_or_inventory(client, retailer_headers):
    create = client.post(
        "/api/medicines",
        headers=retailer_headers,
        json={
            "name": "Test",
            "brand": "Test",
            "strength": "1 mg",
            "packSize": "1",
            "unitPrice": 1,
        },
    )
    assert create.status_code == 403

    adjust = client.post(
        "/api/inventory/batches/BATCH-2/adjust",
        headers=retailer_headers,
        json={"delta": 5, "reason": "Test"},
    )
    assert adjust.status_code == 403


def test_inventory_rows_and_summary(client, admin_headers):
    rows = client.get("/api/inventory", headers=admin_headers)
    assert rows.status_code == 200
    assert len(rows.get_json()) == 5

    summary = client.get("/api/inventory/summary", headers=admin_headers).get_json()
    assert summary["totalBatches"] == 5
    assert summary["totalUnits"] == 255
    assert summary["lowStockCount"] == 2
    assert summary["outOfStockCount"] == 0
    assert summary["nearExpiryCount"] == 3


def test_stock_adjustment_increases_and_logs_movement(
    client, admin_headers, stock
):
    response = client.post(
        "/api/inventory/batches/BATCH-2/adjust",
        headers=admin_headers,
        json={"delta": 5, "reason": "Cycle count"},
    )

    assert response.status_code == 200
    assert stock("BATCH-2") == 75

    movements = client.get("/api/inventory/movements", headers=admin_headers).get_json()
    assert movements[0]["type"] == "Inbound"
    assert movements[0]["quantity"] == 5
    assert movements[0]["medicineId"] == "MED-001"


def test_stock_adjustment_cannot_go_negative(client, admin_headers, stock):
    response = client.post(
        "/api/inventory/batches/BATCH-4/adjust",
        headers=admin_headers,
        json={"delta": -6, "reason": "Damaged"},
    )

    assert response.status_code == 422
    assert stock("BATCH-4") == 5


def test_stock_adjustment_validates_input(client, admin_headers):
    zero = client.post(
        "/api/inventory/batches/BATCH-1/adjust",
        headers=admin_headers,
        json={"delta": 0, "reason": "No change"},
    )
    assert zero.status_code == 422

    reason = client.post(
        "/api/inventory/batches/BATCH-1/adjust",
        headers=admin_headers,
        json={"delta": 1},
    )
    assert reason.status_code == 422
    assert "reason" in reason.get_json()["errors"]


def test_unknown_batch_returns_404(client, admin_headers):
    response = client.post(
        "/api/inventory/batches/BATCH-999/adjust",
        headers=admin_headers,
        json={"delta": 1, "reason": "Test"},
    )
    assert response.status_code == 404


def test_database_rejects_negative_inventory(app):
    from sqlalchemy.exc import IntegrityError

    from app.extensions import db
    from app.models import Inventory

    with app.app_context():
        inventory = Inventory.query.filter_by(batch_id="BATCH-4").one()
        inventory.quantity = -1
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
