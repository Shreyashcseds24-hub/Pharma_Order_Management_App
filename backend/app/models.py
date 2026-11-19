"""Database models.

The schema is intentionally normalised:

    roles, users, retailers, categories, suppliers,
    medicines, batches, inventory, stock_movements,
    orders, order_items, order_item_allocations, order_events,
    invoices, activity_log, notifications, counters, revoked_tokens,
    ai_conversations, ai_messages

Business identifiers are strings (MED-001, BATCH-4201, ORD-2041, ...) because
that is the contract the existing React frontend already uses.
"""

from datetime import datetime, timezone

from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(30), unique=True, nullable=False)
    description = db.Column(db.String(255))

    users = db.relationship("User", back_populates="role")


class Retailer(db.Model):
    __tablename__ = "retailers"

    id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    city = db.Column(db.String(80))
    contact = db.Column(db.String(80))
    phone = db.Column(db.String(40))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    users = db.relationship("User", back_populates="retailer")
    orders = db.relationship("Order", back_populates="retailer_record")
    invoices = db.relationship("Invoice", back_populates="retailer_record")


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    title = db.Column(db.String(120))
    initials = db.Column(db.String(4))
    retailer_id = db.Column(db.String(20), db.ForeignKey("retailers.id"))
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    role = db.relationship("Role", back_populates="users")
    retailer = db.relationship("Retailer", back_populates="users")
    orders_created = db.relationship("Order", back_populates="created_by_user")


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)

    medicines = db.relationship("Medicine", back_populates="category")


class Supplier(db.Model):
    __tablename__ = "suppliers"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    medicines = db.relationship("Medicine", back_populates="supplier")
    batches = db.relationship("Batch", back_populates="supplier")


class Medicine(TimestampMixin, db.Model):
    __tablename__ = "medicines"

    id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    brand = db.Column(db.String(120), nullable=False)
    strength = db.Column(db.String(60), nullable=False)
    dosage_form = db.Column(db.String(40), nullable=False)
    pack_size = db.Column(db.String(120), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"))
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    reorder_level = db.Column(db.Integer, nullable=False, default=0)
    requires_prescription = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    is_sample = db.Column(db.Boolean, nullable=False, default=False)

    category = db.relationship("Category", back_populates="medicines")
    supplier = db.relationship("Supplier", back_populates="medicines")
    batches = db.relationship(
        "Batch",
        back_populates="medicine",
        cascade="all, delete-orphan",
        order_by="Batch.expiry_date",
    )

    __table_args__ = (
        db.CheckConstraint("unit_price >= 0", name="ck_medicines_unit_price_non_negative"),
        db.CheckConstraint("reorder_level >= 0", name="ck_medicines_reorder_non_negative"),
    )


class Batch(db.Model):
    __tablename__ = "batches"

    id = db.Column(db.String(30), primary_key=True)
    medicine_id = db.Column(
        db.String(20), db.ForeignKey("medicines.id"), nullable=False, index=True
    )
    batch_number = db.Column(db.String(60), nullable=False)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    received_date = db.Column(db.Date, nullable=False)
    cost_price = db.Column(db.Numeric(12, 2), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"))
    warehouse = db.Column(db.String(60), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    medicine = db.relationship("Medicine", back_populates="batches")
    supplier = db.relationship("Supplier", back_populates="batches")
    inventory = db.relationship(
        "Inventory", back_populates="batch", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        db.CheckConstraint("cost_price >= 0", name="ck_batches_cost_non_negative"),
        db.UniqueConstraint("medicine_id", "batch_number", name="uq_batch_medicine_number"),
    )


class Inventory(TimestampMixin, db.Model):
    __tablename__ = "inventory"

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(
        db.String(30), db.ForeignKey("batches.id"), unique=True, nullable=False
    )
    quantity = db.Column(db.Integer, nullable=False, default=0)

    batch = db.relationship("Batch", back_populates="inventory")

    __table_args__ = (
        db.CheckConstraint("quantity >= 0", name="ck_inventory_quantity_non_negative"),
    )


class StockMovement(db.Model):
    __tablename__ = "stock_movements"

    id = db.Column(db.String(30), primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    medicine_id = db.Column(db.String(20), db.ForeignKey("medicines.id"), index=True)
    batch_id = db.Column(db.String(30), db.ForeignKey("batches.id"))
    type = db.Column(db.String(30), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    reference = db.Column(db.String(60))
    user = db.Column(db.String(120))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    medicine = db.relationship("Medicine")
    batch = db.relationship("Batch")


class Order(TimestampMixin, db.Model):
    __tablename__ = "orders"

    id = db.Column(db.String(30), primary_key=True)
    retailer_id = db.Column(
        db.String(20), db.ForeignKey("retailers.id"), nullable=False, index=True
    )
    order_date = db.Column(db.Date, nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="Pending", index=True)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    payment_terms = db.Column(db.String(40), nullable=False, default="Net 30")
    warehouse = db.Column(db.String(60), nullable=False)
    created_by = db.Column(db.String(20), db.ForeignKey("users.id"))
    notes = db.Column(db.Text)

    retailer_record = db.relationship("Retailer", back_populates="orders")
    created_by_user = db.relationship("User", back_populates="orders_created")
    items = db.relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderItem.id",
    )
    timeline = db.relationship(
        "OrderEvent",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderEvent.timestamp",
    )
    invoice = db.relationship(
        "Invoice", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        db.CheckConstraint("total_amount >= 0", name="ck_orders_total_non_negative"),
        db.CheckConstraint(
            "status IN ('Pending','Approved','Processing','Shipped','Delivered','Cancelled')",
            name="ck_orders_status_valid",
        ),
    )


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.String(40), primary_key=True)
    order_id = db.Column(
        db.String(30), db.ForeignKey("orders.id"), nullable=False, index=True
    )
    medicine_id = db.Column(
        db.String(20), db.ForeignKey("medicines.id"), nullable=False, index=True
    )
    name = db.Column(db.String(120), nullable=False)
    brand = db.Column(db.String(120), nullable=False)
    pack_size = db.Column(db.String(120), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    line_total = db.Column(db.Numeric(12, 2), nullable=False)

    order = db.relationship("Order", back_populates="items")
    medicine = db.relationship("Medicine")
    allocations = db.relationship(
        "OrderItemAllocation",
        back_populates="item",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),
        db.CheckConstraint("unit_price >= 0", name="ck_order_items_price_non_negative"),
        db.CheckConstraint("line_total >= 0", name="ck_order_items_total_non_negative"),
    )


class OrderItemAllocation(db.Model):
    __tablename__ = "order_item_allocations"

    id = db.Column(db.Integer, primary_key=True)
    order_item_id = db.Column(
        db.String(40), db.ForeignKey("order_items.id"), nullable=False, index=True
    )
    batch_id = db.Column(
        db.String(30), db.ForeignKey("batches.id"), nullable=False, index=True
    )
    quantity = db.Column(db.Integer, nullable=False)

    item = db.relationship("OrderItem", back_populates="allocations")
    batch = db.relationship("Batch")

    __table_args__ = (
        db.CheckConstraint("quantity > 0", name="ck_allocations_quantity_positive"),
    )


class OrderEvent(db.Model):
    __tablename__ = "order_events"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(
        db.String(30), db.ForeignKey("orders.id"), nullable=False, index=True
    )
    label = db.Column(db.String(120), nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    done = db.Column(db.Boolean, nullable=False, default=True)

    order = db.relationship("Order", back_populates="timeline")


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.String(20), primary_key=True)
    invoice_number = db.Column(db.String(40), unique=True, nullable=False)
    order_id = db.Column(
        db.String(30), db.ForeignKey("orders.id"), unique=True, nullable=False
    )
    retailer_id = db.Column(
        db.String(20), db.ForeignKey("retailers.id"), nullable=False, index=True
    )
    invoice_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    total_amount = db.Column(db.Numeric(12, 2), nullable=False)
    tax_amount = db.Column(db.Numeric(12, 2), nullable=False)
    payment_status = db.Column(db.String(20), nullable=False, default="Pending")
    paid_on = db.Column(db.Date)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    order = db.relationship("Order", back_populates="invoice")
    retailer_record = db.relationship("Retailer", back_populates="invoices")

    __table_args__ = (
        db.CheckConstraint("total_amount >= 0", name="ck_invoices_total_non_negative"),
        db.CheckConstraint("tax_amount >= 0", name="ck_invoices_tax_non_negative"),
        db.CheckConstraint(
            "payment_status IN ('Paid','Pending','Overdue','Cancelled')",
            name="ck_invoices_status_valid",
        ),
    )


class ActivityLog(db.Model):
    __tablename__ = "activity_log"

    id = db.Column(db.String(30), primary_key=True)
    type = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(180), nullable=False)
    detail = db.Column(db.String(255))
    time = db.Column(db.Date, nullable=False, index=True)
    actor = db.Column(db.String(120))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(20), primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    detail = db.Column(db.String(255))
    time = db.Column(db.Date, nullable=False)
    tone = db.Column(db.String(20), nullable=False, default="info")
    read = db.Column(db.Boolean, nullable=False, default=False)


class Counter(db.Model):
    """Monotonic counters used to allocate human-readable business IDs."""

    __tablename__ = "counters"

    name = db.Column(db.String(30), primary_key=True)
    value = db.Column(db.Integer, nullable=False, default=0)


class RevokedToken(db.Model):
    __tablename__ = "revoked_tokens"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class AIConversation(TimestampMixin, db.Model):
    """A private AI assistant conversation owned by exactly one user."""

    __tablename__ = "ai_conversations"

    id = db.Column(db.String(30), primary_key=True)
    user_id = db.Column(
        db.String(20), db.ForeignKey("users.id"), nullable=False, index=True
    )
    title = db.Column(db.String(180), nullable=False, default="New conversation")
    last_message_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )

    user = db.relationship("User")
    messages = db.relationship(
        "AIMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AIMessage.created_at",
    )


class AIMessage(db.Model):
    """A single user or assistant turn.

    Tool calls and tool results are intentionally not persisted: they are
    transient execution details. Only the visible conversation text is stored so
    that follow-up questions keep their context without retaining database dumps.
    """

    __tablename__ = "ai_messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.String(30),
        db.ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )

    conversation = db.relationship("AIConversation", back_populates="messages")

    __table_args__ = (
        db.CheckConstraint(
            "role IN ('user','assistant')", name="ck_ai_messages_role_valid"
        ),
    )
