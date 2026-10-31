from datetime import date, timedelta

from tests.conftest import RETAILER

CHENNAI = "Chennai Central WH"


def _create_order(client, headers, items, warehouse=CHENNAI):
    return client.post(
        "/api/orders",
        headers=headers,
        json={"items": items, "warehouse": warehouse},
    )


def test_create_order_computes_totals_and_allocates_fefo(
    client, retailer_headers, admin_headers, stock
):
    response = _create_order(
        client,
        retailer_headers,
        [
            {
                "medicineId": "MED-001",
                "quantity": 40,
                "unitPrice": 0,
                "lineTotal": 0,
            }
        ],
    )

    assert response.status_code == 201
    order = response.get_json()
    assert order["id"] == "ORD-102"
    assert order["status"] == "Pending"
    assert order["retailer"] == "NovaCare Pharmacy Chain"
    assert order["itemCount"] == 1
    assert order["totalQuantity"] == 40
    # Server-side pricing wins over the tampered client values.
    assert order["items"][0]["unitPrice"] == 10.0
    assert order["items"][0]["lineTotal"] == 400.0
    assert order["totalAmount"] == 400.0
    assert order["timeline"][0]["label"] == "Order placed"

    # FEFO: the April batch is consumed first, then the later one.
    assert stock("BATCH-1") == 0
    assert stock("BATCH-2") == 60
    assert stock("BATCH-3") == 50

    invoices = client.get("/api/invoices", headers=admin_headers).get_json()
    invoice = next(row for row in invoices if row["orderId"] == "ORD-102")
    assert invoice["totalAmount"] == 400.0
    assert invoice["taxAmount"] == 20.0
    assert invoice["grandTotal"] == 420.0
    assert invoice["paymentStatus"] == "Pending"


def test_create_order_uses_preferred_warehouse_first(
    client, retailer_headers, stock
):
    response = _create_order(
        client,
        retailer_headers,
        [{"medicineId": "MED-001", "quantity": 10}],
        warehouse="Bengaluru South WH",
    )

    assert response.status_code == 201
    assert stock("BATCH-3") == 40
    assert stock("BATCH-1") == 30


def test_order_rejects_quantities_above_usable_stock(
    client, retailer_headers, stock, db_query
):
    from app.models import Order

    response = _create_order(
        client, retailer_headers, [{"medicineId": "MED-001", "quantity": 151}]
    )

    assert response.status_code == 422
    assert "150" in response.get_json()["message"]
    assert stock("BATCH-1") == 30
    assert stock("BATCH-2") == 70
    assert db_query(lambda: Order.query.count()) == 2


def test_order_ignores_expired_stock(client, retailer_headers):
    response = _create_order(
        client, retailer_headers, [{"medicineId": "MED-003", "quantity": 1}]
    )

    assert response.status_code == 422


def test_order_validates_items(client, retailer_headers):
    empty = _create_order(client, retailer_headers, [])
    assert empty.status_code == 422

    zero = _create_order(
        client, retailer_headers, [{"medicineId": "MED-001", "quantity": 0}]
    )
    assert zero.status_code == 422

    unknown = _create_order(
        client, retailer_headers, [{"medicineId": "MED-999", "quantity": 1}]
    )
    assert unknown.status_code == 422


def test_only_retailers_can_place_orders(client, admin_headers, distributor_headers):
    payload = {"items": [{"medicineId": "MED-001", "quantity": 1}], "warehouse": CHENNAI}

    assert client.post("/api/orders", headers=admin_headers, json=payload).status_code == 403
    assert (
        client.post("/api/orders", headers=distributor_headers, json=payload).status_code
        == 403
    )


def test_retailers_only_see_their_own_orders(
    client, retailer_headers, retailer_two_headers, distributor_headers
):
    nova_orders = client.get("/api/orders", headers=retailer_headers).get_json()
    assert {order["id"] for order in nova_orders} == {"ORD-101"}

    apex_orders = client.get("/api/orders", headers=retailer_two_headers).get_json()
    assert {order["id"] for order in apex_orders} == {"ORD-100"}
    assert (
        client.get("/api/orders/ORD-101", headers=retailer_two_headers).status_code
        == 404
    )

    all_orders = client.get("/api/orders", headers=distributor_headers).get_json()
    assert {order["id"] for order in all_orders} == {"ORD-100", "ORD-101"}


def test_order_status_workflow_is_enforced(client, distributor_headers, retailer_headers):
    pending = client.get("/api/orders/ORD-101", headers=distributor_headers).get_json()
    assert pending["status"] == "Pending"

    forbidden = client.patch(
        "/api/orders/ORD-101/status",
        headers=retailer_headers,
        json={"status": "Approved"},
    )
    assert forbidden.status_code == 403

    skipped = client.patch(
        "/api/orders/ORD-101/status",
        headers=distributor_headers,
        json={"status": "Shipped"},
    )
    assert skipped.status_code == 422

    for status in ("Approved", "Processing", "Shipped", "Delivered"):
        response = client.patch(
            "/api/orders/ORD-101/status",
            headers=distributor_headers,
            json={"status": status},
        )
        assert response.status_code == 200, response.get_json()
        assert response.get_json()["status"] == status

    final = client.patch(
        "/api/orders/ORD-101/status",
        headers=distributor_headers,
        json={"status": "Cancelled"},
    )
    assert final.status_code == 422


def test_cancelling_an_order_restores_stock_and_cancels_invoice(
    client, retailer_headers, admin_headers, stock
):
    created = _create_order(
        client, retailer_headers, [{"medicineId": "MED-001", "quantity": 40}]
    )
    assert created.status_code == 201
    assert stock("BATCH-1") == 0
    assert stock("BATCH-2") == 60

    cancelled = client.patch(
        "/api/orders/ORD-102/status",
        headers=retailer_headers,
        json={"status": "Cancelled"},
    )
    assert cancelled.status_code == 200
    assert cancelled.get_json()["status"] == "Cancelled"
    assert stock("BATCH-1") == 30
    assert stock("BATCH-2") == 70

    invoices = client.get("/api/invoices", headers=admin_headers).get_json()
    invoice = next(row for row in invoices if row["orderId"] == "ORD-102")
    assert invoice["paymentStatus"] == "Cancelled"

    movements = client.get("/api/inventory/movements", headers=retailer_headers).get_json()
    returns = [row for row in movements if row["type"] == "Return"]
    assert sum(row["quantity"] for row in returns) == 40


def test_retailer_cannot_cancel_someone_elses_order(client, retailer_two_headers):
    response = client.patch(
        "/api/orders/ORD-101/status",
        headers=retailer_two_headers,
        json={"status": "Cancelled"},
    )
    assert response.status_code == 404


def test_new_order_is_visible_after_a_fresh_login(client):
    login = client.post("/api/auth/login", json=RETAILER)
    headers = {"Authorization": f"Bearer {login.get_json()['token']}"}
    created = _create_order(
        client, headers, [{"medicineId": "MED-002", "quantity": 2}]
    )
    assert created.status_code == 201

    # A brand-new session (as after a page refresh) reads the persisted order.
    second = client.post("/api/auth/login", json=RETAILER).get_json()
    refreshed = client.get(
        "/api/orders",
        headers={"Authorization": f"Bearer {second['token']}"},
    ).get_json()
    assert "ORD-102" in {order["id"] for order in refreshed}


def test_order_response_matches_frontend_contract(client, admin_headers):
    order = client.get("/api/orders/ORD-100", headers=admin_headers).get_json()

    assert set(order) == {
        "id",
        "retailerId",
        "retailer",
        "orderDate",
        "status",
        "items",
        "itemCount",
        "totalQuantity",
        "totalAmount",
        "paymentTerms",
        "warehouse",
        "timeline",
    }
    assert order["orderDate"] == (date.today() - timedelta(days=3)).isoformat()
    assert order["items"][0]["lineTotal"] == 200.0
    assert isinstance(order["timeline"], list)


def test_admin_cannot_place_orders(client, admin_headers):
    response = _create_order(
        client, admin_headers, [{"medicineId": "MED-001", "quantity": 1}]
    )
    assert response.status_code == 403
