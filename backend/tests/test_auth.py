from tests.conftest import ADMIN, RETAILER


def test_login_returns_user_session_and_permissions(client):
    response = client.post("/api/auth/login", json=ADMIN)

    assert response.status_code == 200
    body = response.get_json()
    assert body["token"]
    assert body["issuedAt"] > 0
    user = body["user"]
    assert user["email"] == ADMIN["email"]
    assert user["role"] == "admin"
    assert user["permissions"] == [
        "catalog:write",
        "inventory:write",
        "orders:approve",
        "reports:view",
        "settings:write",
    ]


def test_login_rejects_wrong_password(client):
    response = client.post(
        "/api/auth/login", json={"email": ADMIN["email"], "password": "nope"}
    )

    assert response.status_code == 401
    assert response.get_json()["message"] == "Invalid email or password."


def test_login_rejects_role_mismatch(client):
    response = client.post(
        "/api/auth/login", json={**ADMIN, "role": "retailer"}
    )

    assert response.status_code == 403


def test_login_validates_empty_payload(client):
    response = client.post("/api/auth/login", json={})

    assert response.status_code == 422
    assert set(response.get_json()["errors"]) == {"email", "password"}


def test_protected_endpoints_require_a_token(client):
    for path in (
        "/api/medicines",
        "/api/orders",
        "/api/inventory",
        "/api/analytics/dashboard",
        "/api/invoices",
    ):
        response = client.get(path)
        assert response.status_code == 401, path


def test_logout_revokes_the_token(client, admin_headers):
    assert client.post("/api/auth/logout", headers=admin_headers).status_code == 200

    response = client.get("/api/medicines", headers=admin_headers)
    assert response.status_code == 401


def test_register_creates_a_retailer_account_and_retailer(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Meera Sundar",
            "email": "meera@newpharmacy.dev",
            "password": "strongpass123",
            "organisation": "New Pharmacy",
            "role": "retailer",
            "city": "Chennai",
        },
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["user"]["role"] == "retailer"
    assert body["user"]["retailerId"] == "RTL-03"
    assert body["token"]

    login = client.post(
        "/api/auth/login",
        json={"email": "meera@newpharmacy.dev", "password": "strongpass123"},
    )
    assert login.status_code == 200


def test_register_rejects_duplicate_email(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Someone Else",
            "email": ADMIN["email"],
            "password": "strongpass123",
            "organisation": "Another Org",
            "role": "admin",
        },
    )

    assert response.status_code == 409


def test_register_validates_required_fields(client):
    response = client.post("/api/auth/register", json={"role": "retailer"})

    assert response.status_code == 422
    assert set(response.get_json()["errors"]) == {
        "name",
        "email",
        "password",
        "organisation",
    }


def test_profile_can_be_read_and_updated(client, admin_headers):
    current = client.get("/api/auth/profile", headers=admin_headers)
    assert current.status_code == 200
    assert current.get_json()["user"]["name"] == "Ananya Krishnan"

    updated = client.patch(
        "/api/auth/profile",
        headers=admin_headers,
        json={"name": "Ananya Rao", "title": "Operations Lead"},
    )
    assert updated.status_code == 200
    assert updated.get_json()["user"]["name"] == "Ananya Rao"
    assert updated.get_json()["user"]["initials"] == "AR"

    again = client.get("/api/auth/profile", headers=admin_headers)
    assert again.get_json()["user"]["title"] == "Operations Lead"


def test_change_password_flow(client, admin_headers):
    wrong = client.post(
        "/api/auth/password",
        headers=admin_headers,
        json={"currentPassword": "incorrect", "newPassword": "newpassword1"},
    )
    assert wrong.status_code == 422

    changed = client.post(
        "/api/auth/password",
        headers=admin_headers,
        json={"currentPassword": ADMIN["password"], "newPassword": "newpassword1"},
    )
    assert changed.status_code == 200

    old = client.post("/api/auth/login", json=ADMIN)
    assert old.status_code == 401

    new = client.post(
        "/api/auth/login",
        json={"email": ADMIN["email"], "password": "newpassword1"},
    )
    assert new.status_code == 200


def test_retailer_login_has_limited_permissions(client):
    response = client.post("/api/auth/login", json=RETAILER)

    assert response.status_code == 200
    assert response.get_json()["user"]["permissions"] == [
        "orders:create",
        "reports:view",
    ]
