"""Shared pytest fixtures.

By default the suite runs on an in-memory SQLite database so it is fast and
needs no external services. Set ``TEST_DATABASE_URL`` to a PostgreSQL URL to
run the exact same suite against PostgreSQL:

    TEST_DATABASE_URL=postgresql://user:pass@host:5432/mediflow_test pytest
"""

import os
from datetime import date, timedelta

import pytest
from werkzeug.security import generate_password_hash

from app import create_app
from app.config import _database_url
from app.extensions import db
from app.models import (
    Batch,
    Category,
    Counter,
    Inventory,
    Invoice,
    Medicine,
    Notification,
    Order,
    OrderEvent,
    OrderItem,
    Retailer,
    Role,
    StockMovement,
    Supplier,
    User,
    utcnow,
)
from app.utils import money

TODAY = date.today()

ADMIN = {"email": "admin@test.dev", "password": "admin123"}
DISTRIBUTOR = {"email": "dist@test.dev", "password": "dist1234"}
RETAILER = {"email": "retailer@test.dev", "password": "retail123"}
RETAILER_TWO = {"email": "retailer2@test.dev", "password": "retail123"}


@pytest.fixture(scope="session")
def app():
    uri = _database_url(os.environ.get("TEST_DATABASE_URL", "sqlite://"))
    application = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": uri,
            "SQLALCHEMY_ENGINE_OPTIONS": {},
            "JWT_SECRET_KEY": "test-secret-key-that-is-at-least-32-bytes",
            "SECRET_KEY": "test-secret-key-that-is-at-least-32-bytes",
            "JWT_ACCESS_TOKEN_EXPIRES": timedelta(hours=1),
            "REGISTRATION_ALLOWED_ROLES": ["admin", "distributor", "retailer"],
            "PROPAGATE_EXCEPTIONS": False,
        }
    )
    with application.app_context():
        db.drop_all()
        db.create_all()
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    with app.app_context():
        db.drop_all()
        db.create_all()
        _seed()
    return app.test_client()


@pytest.fixture()
def login(client):
    def _login(account):
        response = client.post("/api/auth/login", json=account)
        assert response.status_code == 200, response.get_json()
        return {"Authorization": f"Bearer {response.get_json()['token']}"}

    return _login


@pytest.fixture()
def admin_headers(login):
    return login(ADMIN)


@pytest.fixture()
def distributor_headers(login):
    return login(DISTRIBUTOR)


@pytest.fixture()
def retailer_headers(login):
    return login(RETAILER)


@pytest.fixture()
def retailer_two_headers(login):
    return login(RETAILER_TWO)


@pytest.fixture()
def db_query(app):
    """Run a read-only query inside a fresh app context."""

    def _query(fn):
        with app.app_context():
            return fn()

    return _query


@pytest.fixture()
def stock(db_query):
    def _stock(batch_id):
        return db_query(
            lambda: Inventory.query.filter_by(batch_id=batch_id).one().quantity
        )

    return _stock


def _seed():
    roles = {name: Role(name=name, description=name.title()) for name in ("admin", "distributor", "retailer")}
    db.session.add_all(roles.values())
    db.session.flush()

    apex = Retailer(id="RTL-01", name="Apex Medical Retail", city="Chennai", contact="S. Balaji", phone="+91 98400 11223")
    nova = Retailer(id="RTL-02", name="NovaCare Pharmacy Chain", city="Bengaluru", contact="P. Nandini", phone="+91 99000 55412")
    db.session.add_all([apex, nova])
    db.session.flush()

    for user_id, name, account, role, initials, retailer in (
        ("USR-1", "Ananya Krishnan", ADMIN, "admin", "AK", None),
        ("USR-2", "Karthik Iyer", DISTRIBUTOR, "distributor", "KI", None),
        ("USR-3", "Priya Nandini", RETAILER, "retailer", "PN", nova),
        ("USR-4", "Ravi Menon", RETAILER_TWO, "retailer", "RM", apex),
    ):
        db.session.add(
            User(
                id=user_id,
                name=name,
                email=account["email"],
                password_hash=generate_password_hash(account["password"]),
                role=roles[role],
                title=role.title(),
                initials=initials,
                retailer_id=retailer.id if retailer else None,
            )
        )
    db.session.flush()

    analgesic = Category(name="Analgesic")
    antibiotic = Category(name="Antibiotic")
    supplier = Supplier(name="MedCore Distributors")
    db.session.add_all([analgesic, antibiotic, supplier])
    db.session.flush()

    paracetamol = Medicine(
        id="MED-001",
        name="Paracetamol",
        brand="Panadol",
        strength="500 mg",
        dosage_form="Tablet",
        pack_size="10 tablets x 10 strips",
        category=analgesic,
        supplier=supplier,
        unit_price=money(10),
        reorder_level=100,
        is_active=True,
    )
    amoxicillin = Medicine(
        id="MED-002",
        name="Amoxicillin",
        brand="Moxicip",
        strength="500 mg",
        dosage_form="Capsule",
        pack_size="10 capsules x 10 strips",
        category=antibiotic,
        supplier=supplier,
        unit_price=money(20),
        reorder_level=10,
        requires_prescription=True,
        is_active=True,
    )
    expired = Medicine(
        id="MED-003",
        name="Ibuprofen",
        brand="Brufen",
        strength="400 mg",
        dosage_form="Tablet",
        pack_size="10 tablets x 10 strips",
        category=analgesic,
        supplier=supplier,
        unit_price=money(5),
        reorder_level=10,
        is_active=True,
    )
    db.session.add_all([paracetamol, amoxicillin, expired])
    db.session.flush()

    batches = [
        Batch(
            id="BATCH-1",
            medicine=paracetamol,
            batch_number="MF001",
            expiry_date=TODAY + timedelta(days=20),
            received_date=TODAY - timedelta(days=10),
            cost_price=money(8),
            supplier=supplier,
            warehouse="Chennai Central WH",
        ),
        Batch(
            id="BATCH-2",
            medicine=paracetamol,
            batch_number="MF002",
            expiry_date=TODAY + timedelta(days=300),
            received_date=TODAY - timedelta(days=30),
            cost_price=money(8),
            supplier=supplier,
            warehouse="Chennai Central WH",
        ),
        Batch(
            id="BATCH-3",
            medicine=paracetamol,
            batch_number="MF003",
            expiry_date=TODAY + timedelta(days=10),
            received_date=TODAY - timedelta(days=5),
            cost_price=money(8),
            supplier=supplier,
            warehouse="Bengaluru South WH",
        ),
        Batch(
            id="BATCH-4",
            medicine=amoxicillin,
            batch_number="MF004",
            expiry_date=TODAY + timedelta(days=200),
            received_date=TODAY - timedelta(days=20),
            cost_price=money(16),
            supplier=supplier,
            warehouse="Chennai Central WH",
        ),
        Batch(
            id="BATCH-5",
            medicine=expired,
            batch_number="MF005",
            expiry_date=TODAY - timedelta(days=5),
            received_date=TODAY - timedelta(days=200),
            cost_price=money(4),
            supplier=supplier,
            warehouse="Chennai Central WH",
        ),
    ]
    db.session.add_all(batches)
    db.session.flush()
    db.session.add_all(
        [
            Inventory(batch_id="BATCH-1", quantity=30),
            Inventory(batch_id="BATCH-2", quantity=70),
            Inventory(batch_id="BATCH-3", quantity=50),
            Inventory(batch_id="BATCH-4", quantity=5),
            Inventory(batch_id="BATCH-5", quantity=100),
        ]
    )

    historical = Order(
        id="ORD-100",
        retailer_id=apex.id,
        order_date=TODAY - timedelta(days=3),
        status="Delivered",
        total_amount=money(400),
        payment_terms="Net 30",
        warehouse="Chennai Central WH",
        created_by="USR-4",
    )
    pending = Order(
        id="ORD-101",
        retailer_id=nova.id,
        order_date=TODAY - timedelta(days=1),
        status="Pending",
        total_amount=money(100),
        payment_terms="Net 30",
        warehouse="Chennai Central WH",
        created_by="USR-3",
    )
    db.session.add_all([historical, pending])
    db.session.flush()

    db.session.add_all(
        [
            OrderItem(
                id="ITM-100-1",
                order=historical,
                medicine_id=paracetamol.id,
                name="Paracetamol 500 mg",
                brand="Panadol",
                pack_size="10 tablets x 10 strips",
                quantity=20,
                unit_price=money(10),
                line_total=money(200),
            ),
            OrderItem(
                id="ITM-100-2",
                order=historical,
                medicine_id=amoxicillin.id,
                name="Amoxicillin 500 mg",
                brand="Moxicip",
                pack_size="10 capsules x 10 strips",
                quantity=10,
                unit_price=money(20),
                line_total=money(200),
            ),
            OrderItem(
                id="ITM-101-1",
                order=pending,
                medicine_id=paracetamol.id,
                name="Paracetamol 500 mg",
                brand="Panadol",
                pack_size="10 tablets x 10 strips",
                quantity=10,
                unit_price=money(10),
                line_total=money(100),
            ),
        ]
    )
    db.session.add_all(
        [
            OrderEvent(order=historical, label="Order placed", timestamp=utcnow(), done=True),
            OrderEvent(order=historical, label="Delivered and confirmed", timestamp=utcnow(), done=True),
            OrderEvent(order=pending, label="Order placed", timestamp=utcnow(), done=True),
        ]
    )

    db.session.add(
        Invoice(
            id="INV-200",
            invoice_number="MF/25-26/01000",
            order=historical,
            retailer_id=apex.id,
            invoice_date=TODAY - timedelta(days=3),
            due_date=TODAY + timedelta(days=27),
            total_amount=money(400),
            tax_amount=money(20),
            payment_status="Paid",
            paid_on=TODAY - timedelta(days=1),
        )
    )

    db.session.add_all(
        [
            StockMovement(
                id="MOV-100",
                date=TODAY - timedelta(days=3),
                medicine_id=paracetamol.id,
                batch_id="BATCH-1",
                type="Outbound",
                quantity=-20,
                reference="ORD-100",
                user="System (order fulfilment)",
            ),
            Notification(
                id="N-1",
                title="Low stock: Amoxicillin",
                detail="Only 5 units remain",
                time=TODAY,
                tone="warning",
                read=False,
            ),
        ]
    )

    for name, value in {
        "medicine": 3,
        "batch": 5,
        "order": 101,
        "invoice": 200,
        "invoice_number": 1000,
        "movement": 100,
        "activity": 100,
        "user": 4,
        "retailer": 2,
        "adjustment": 0,
    }.items():
        db.session.add(Counter(name=name, value=value))

    db.session.commit()
