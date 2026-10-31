import os
import threading

import pytest

from tests.conftest import RETAILER, RETAILER_TWO

pytestmark = pytest.mark.skipif(
    "postgres" not in os.environ.get("TEST_DATABASE_URL", ""),
    reason="row-level locking assertions require PostgreSQL",
)


def test_concurrent_checkouts_cannot_oversell(app, client, stock):
    statuses = []
    errors = []
    barrier = threading.Barrier(2)

    def place(account):
        try:
            local = app.test_client()
            login = local.post("/api/auth/login", json=account)
            headers = {"Authorization": f"Bearer {login.get_json()['token']}"}
            barrier.wait(timeout=10)
            response = local.post(
                "/api/orders",
                headers=headers,
                json={
                    "items": [{"medicineId": "MED-001", "quantity": 100}],
                    "warehouse": "Chennai Central WH",
                },
            )
            statuses.append(response.status_code)
        except Exception as error:  # pragma: no cover - surfaced below
            errors.append(error)

    threads = [
        threading.Thread(target=place, args=(RETAILER,)),
        threading.Thread(target=place, args=(RETAILER_TWO,)),
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert not errors
    assert sorted(statuses) == [201, 422]
    assert stock("BATCH-1") == 0
    assert stock("BATCH-2") == 0
    assert stock("BATCH-3") == 50
