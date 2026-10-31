def _place_order(client, headers, medicine_id="MED-001", quantity=40):
    response = client.post(
        "/api/orders",
        headers=headers,
        json={
            "items": [{"medicineId": medicine_id, "quantity": quantity}],
            "warehouse": "Chennai Central WH",
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_invoice_list_and_detail_contract(client, admin_headers):
    invoices = client.get("/api/invoices", headers=admin_headers)
    assert invoices.status_code == 200
    assert any(row["id"] == "INV-200" for row in invoices.get_json())

    response = client.get("/api/invoices/INV-200", headers=admin_headers)
    assert response.status_code == 200
    detail = response.get_json()
    assert detail["invoiceNumber"] == "MF/25-26/01000"
    assert detail["orderId"] == "ORD-100"
    assert detail["retailerRecord"]["id"] == "RTL-01"
    assert detail["warehouse"] == "Chennai Central WH"
    assert detail["taxAmount"] == 20.0
    assert detail["grandTotal"] == 420.0
    assert len(detail["items"]) == 2


def test_retailers_cannot_access_invoice_endpoints(client, retailer_headers):
    assert client.get("/api/invoices", headers=retailer_headers).status_code == 403
    assert (
        client.get("/api/invoices/INV-200", headers=retailer_headers).status_code == 403
    )
    assert (
        client.post(
            "/api/invoices/INV-200/payment", headers=retailer_headers
        ).status_code
        == 403
    )


def test_recording_payment_is_idempotent(client, retailer_headers, admin_headers):
    response = client.post("/api/invoices/INV-200/payment", headers=admin_headers)
    # INV-200 is already paid in the fixture, so the endpoint returns it unchanged.
    assert response.status_code == 200
    assert response.get_json()["paymentStatus"] == "Paid"
    assert response.get_json()["paidOn"]

    order = _place_order(client, retailer_headers)
    invoices = client.get("/api/invoices", headers=admin_headers).get_json()
    invoice = next(row for row in invoices if row["orderId"] == order["id"])
    assert invoice["paymentStatus"] == "Pending"

    paid = client.post(
        f"/api/invoices/{invoice['id']}/payment", headers=admin_headers
    )
    assert paid.status_code == 200
    assert paid.get_json()["paymentStatus"] == "Paid"
    assert paid.get_json()["paidOn"]


def test_cancelled_invoice_cannot_be_paid(client, retailer_headers, admin_headers):
    order = _place_order(client, retailer_headers)
    client.patch(
        f"/api/orders/{order['id']}/status",
        headers=retailer_headers,
        json={"status": "Cancelled"},
    )
    invoices = client.get("/api/invoices", headers=admin_headers).get_json()
    invoice = next(row for row in invoices if row["orderId"] == order["id"])

    response = client.post(
        f"/api/invoices/{invoice['id']}/payment", headers=admin_headers
    )
    assert response.status_code == 422


def test_unknown_invoice_returns_404(client, admin_headers):
    assert (
        client.get("/api/invoices/INV-999", headers=admin_headers).status_code == 404
    )


def test_dashboard_returns_live_totals(client, admin_headers):
    response = client.get("/api/analytics/dashboard", headers=admin_headers)

    assert response.status_code == 200
    body = response.get_json()
    assert set(body) == {
        "stats",
        "sales",
        "recentOrders",
        "lowStock",
        "insights",
        "activity",
        "notifications",
    }
    assert body["stats"]["totalMedicines"] == 3
    assert body["stats"]["pendingOrders"] == 1
    assert body["stats"]["lowStockMedicines"] == 2
    assert body["stats"]["nearExpiryBatches"] == 3
    low_stock = {row["id"]: row for row in body["lowStock"]}
    assert low_stock["MED-002"]["quantity"] == 5
    assert low_stock["MED-003"]["quantity"] == 0
    assert len(body["sales"]["7d"]) == 7
    assert len(body["sales"]["30d"]) == 30
    assert len(body["sales"]["90d"]) == 90
    assert {order["id"] for order in body["recentOrders"]} == {"ORD-100", "ORD-101"}
    assert body["insights"]["recommendations"][0]["medicineId"] == "MED-003"
    assert body["notifications"][0]["id"] == "N-1"


def test_retailer_dashboard_is_scoped_to_their_orders(client, retailer_headers):
    body = client.get(
        "/api/analytics/dashboard", headers=retailer_headers
    ).get_json()
    assert {order["id"] for order in body["recentOrders"]} == {"ORD-101"}


def test_reports_are_built_from_database_rows(client, admin_headers):
    response = client.get("/api/analytics/reports", headers=admin_headers)

    assert response.status_code == 200
    body = response.get_json()
    assert set(body) == {
        "salesTrend",
        "orderVolume",
        "topSelling",
        "inventoryValuation",
        "stockMovement",
        "expiryRisk",
        "kpis",
    }
    assert len(body["salesTrend"]) == 30
    assert dict(
        (row["status"], row["value"]) for row in body["orderVolume"]
    ) == {"Pending": 1, "Delivered": 1}
    assert body["topSelling"][0]["medicineId"] == "MED-001"
    assert body["topSelling"][0]["units"] == 20
    assert body["inventoryValuation"]["batchCount"] == 5
    assert body["inventoryValuation"]["totalValue"] == 1680
    assert body["inventoryValuation"]["retailValue"] == 2100
    assert body["expiryRisk"]["totalValueAtRisk"] == 1040
    assert body["expiryRisk"]["expiredValue"] == 400
    assert body["kpis"]["orders30d"] == 2
    assert body["kpis"]["units30d"] == 40
    assert body["kpis"]["revenue30d"] == 500
    assert body["kpis"]["avgOrderValue"] == 250


def test_forecast_returns_server_side_projection(client, admin_headers):
    response = client.get(
        "/api/analytics/forecast?horizon=7", headers=admin_headers
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["horizon"] == 7
    assert body["isDemo"] is False
    assert body["model"]["name"] == "Moving-average rule engine"
    assert body["model"]["sampleSize"] == 3
    assert "not predictions from a trained" in body["disclaimer"]
    assert len(body["monthlyForecast"]) == 8

    demand = {row["medicineId"]: row for row in body["demandForecast"]}
    assert demand["MED-001"]["predicted"] == 7
    assert demand["MED-002"]["predicted"] == 3
    assert demand["MED-001"]["actual"] == 30

    recommendation = next(
        row for row in body["recommendations"] if row["medicineId"] == "MED-002"
    )
    assert recommendation["suggestedQuantity"] == 5
    assert recommendation["urgency"] == "critical"
    assert len(body["expiryRisk"]) == 3


def test_analytics_requires_authentication(client):
    for path in (
        "/api/analytics/dashboard",
        "/api/analytics/reports",
        "/api/analytics/forecast",
    ):
        assert client.get(path).status_code == 401
