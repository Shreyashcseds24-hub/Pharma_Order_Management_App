from datetime import date, timedelta
from decimal import Decimal
import logging

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from ..errors import ApiError
from ..extensions import db
from ..logging_config import log_event
from ..models import (
    Batch,
    Inventory,
    Invoice,
    Medicine,
    Order,
    OrderEvent,
    OrderItem,
    OrderItemAllocation,
    Retailer,
    utcnow,
)
from ..permissions import load_current_user, permissions_for, require_permission
from ..serializers import order_to_dict, retailer_to_dict
from ..utils import (
    add_activity,
    add_movement,
    money,
    next_business_id,
    next_counter,
    parse_int,
)

orders_bp = Blueprint("orders", __name__, url_prefix="/orders")
retailers_bp = Blueprint("retailers", __name__, url_prefix="/retailers")

STATUS_LABELS = {
    "Pending": "Order placed",
    "Approved": "Approved by distributor",
    "Processing": "Picking started",
    "Shipped": "Dispatched - AWB generated",
    "Delivered": "Delivered and confirmed",
    "Cancelled": "Cancelled",
}

TRANSITIONS = {
    "Pending": {"Approved", "Cancelled"},
    "Approved": {"Processing", "Cancelled"},
    "Processing": {"Shipped"},
    "Shipped": {"Delivered"},
    "Delivered": set(),
    "Cancelled": set(),
}

CANCELLABLE = {"Pending", "Approved"}


def _scoped_order(order_id, user):
    order = db.session.get(Order, order_id)
    if order is None:
        raise ApiError("Order not found.", 404)
    if user.role.name == "retailer" and order.retailer_id != user.retailer_id:
        raise ApiError("Order not found.", 404)
    return order


def _sellable_inventory(medicine_id, *, lock=False, warehouse=None):
    query = (
        db.session.query(Inventory, Batch)
        .join(Batch, Inventory.batch_id == Batch.id)
        .filter(
            Batch.medicine_id == medicine_id,
            Inventory.quantity > 0,
            Batch.expiry_date >= date.today(),
        )
    )
    if lock:
        query = query.with_for_update()
    rows = query.all()

    def sort_key(row):
        inventory, batch = row
        preferred = 0 if not warehouse or batch.warehouse == warehouse else 1
        return (preferred, batch.expiry_date, batch.id)

    return sorted(rows, key=sort_key)


def _available_units(medicine_id):
    return sum(inventory.quantity for inventory, _ in _sellable_inventory(medicine_id))


def _normalise_items(payload):
    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raise ApiError("Add at least one medicine to the order.", 422, {"items": "At least one item is required."})
    if len(raw_items) > 100:
        raise ApiError("An order cannot contain more than 100 lines.", 422)

    combined = {}
    order = []
    for index, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            raise ApiError("Each order item must be an object.", 422)
        medicine_id = str(raw.get("medicineId") or "").strip()
        if not medicine_id:
            raise ApiError(
                f"Item {index + 1} is missing a medicine.",
                422,
                {f"items[{index}].medicineId": "Medicine is required."},
            )
        quantity = parse_int(
            raw.get("quantity"),
            f"items[{index}].quantity",
            minimum=1,
            maximum=100000,
        )
        if medicine_id not in combined:
            combined[medicine_id] = {"medicineId": medicine_id, "quantity": 0}
            order.append(combined[medicine_id])
        combined[medicine_id]["quantity"] += quantity
    return order


@orders_bp.get("")
@jwt_required()
def list_orders():
    user = load_current_user()
    query = Order.query
    if user.role.name == "retailer":
        if not user.retailer_id:
            return jsonify([])
        query = query.filter(Order.retailer_id == user.retailer_id)
    orders = query.order_by(
        Order.order_date.desc(), Order.created_at.desc(), Order.id.desc()
    ).all()
    return jsonify([order_to_dict(order) for order in orders])


@orders_bp.get("/<order_id>")
@jwt_required()
def get_order(order_id):
    user = load_current_user()
    return jsonify(order_to_dict(_scoped_order(order_id, user)))


@orders_bp.post("")
@require_permission("orders:create")
def create_order():
    user = load_current_user()
    if not user.retailer_id:
        raise ApiError(
            "No retailer profile is linked to this account. Contact an administrator.",
            422,
        )
    payload = request.get_json(silent=True) or {}
    items = _normalise_items(payload)
    warehouse = str(payload.get("warehouse") or "Chennai Central WH").strip()
    if not warehouse or len(warehouse) > 60:
        raise ApiError("Select a fulfilment warehouse.", 422, {"warehouse": "A warehouse is required."})

    medicines = {}
    for line in items:
        medicine = db.session.get(Medicine, line["medicineId"])
        if medicine is None or not medicine.is_active:
            raise ApiError(
                "One of the selected medicines is no longer available.",
                422,
            )
        available = _available_units(medicine.id)
        if available < line["quantity"]:
            raise ApiError(
                f"Only {available} units of {medicine.name} {medicine.strength} are in stock.",
                422,
            )
        medicines[medicine.id] = medicine

    order = Order(
        id=next_business_id("order", "ORD", 2041),
        retailer_id=user.retailer_id,
        order_date=date.today(),
        status="Pending",
        payment_terms="Net 30",
        warehouse=warehouse,
        created_by=user.id,
        total_amount=money(0),
    )
    db.session.add(order)
    db.session.flush()

    total = money(0)
    items_created = 0
    for line in items:
        medicine = medicines[line["medicineId"]]
        quantity = line["quantity"]
        unit_price = money(medicine.unit_price)
        line_total = money(unit_price * quantity)
        total += line_total
        items_created += 1

        item = OrderItem(
            id=f"ITM-{order.id.split('-')[-1]}-{items_created}",
            order=order,
            medicine_id=medicine.id,
            name=f"{medicine.name} {medicine.strength}",
            brand=medicine.brand,
            pack_size=medicine.pack_size,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.session.add(item)
        db.session.flush()

        remaining = quantity
        for inventory, batch in _sellable_inventory(
            medicine.id, lock=True, warehouse=warehouse
        ):
            if remaining <= 0:
                break
            take = min(remaining, inventory.quantity)
            inventory.quantity -= take
            remaining -= take
            db.session.add(
                OrderItemAllocation(
                    order_item_id=item.id,
                    batch_id=batch.id,
                    quantity=take,
                )
            )
            add_movement(
                medicine,
                batch,
                "Outbound",
                -take,
                order.id,
                "System (order fulfilment)",
            )
        if remaining > 0:
            raise ApiError(
                f"Only {quantity - remaining} units of {medicine.name} {medicine.strength} are in stock.",
                422,
            )

    order.total_amount = money(total)
    db.session.add(OrderEvent(order=order, label=STATUS_LABELS["Pending"], timestamp=utcnow(), done=True))

    invoice_number = next_counter("invoice_number", 1291)
    invoice = Invoice(
        id=next_business_id("invoice", "INV", 9038),
        invoice_number=f"MF/25-26/{invoice_number:05d}",
        order=order,
        retailer_id=order.retailer_id,
        invoice_date=order.order_date,
        due_date=order.order_date + timedelta(days=30),
        total_amount=order.total_amount,
        tax_amount=money(order.total_amount * Decimal("0.05")),
        payment_status="Pending",
    )
    db.session.add(invoice)

    add_activity(
        "order",
        f"New order {order.id} placed",
        f"{order.retailer_record.name if order.retailer_record else 'Retailer'} - {items_created} items",
        user.name,
    )
    db.session.commit()
    log_event(
        current_app.logger,
        "order.created",
        order_id=order.id,
        retailer_id=order.retailer_id,
        item_count=items_created,
        total_amount=float(order.total_amount),
        warehouse=order.warehouse,
        user_id=user.id,
        role=user.role.name,
    )
    log_event(
        current_app.logger,
        "invoice.created",
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        order_id=order.id,
        total_amount=float(invoice.total_amount),
        tax_amount=float(invoice.tax_amount),
    )
    return jsonify(order_to_dict(order)), 201


@orders_bp.patch("/<order_id>/status")
@jwt_required()
def update_order_status(order_id):
    user = load_current_user()
    order = _scoped_order(order_id, user)
    payload = request.get_json(silent=True) or {}
    status = str(payload.get("status") or "").strip()
    if status not in STATUS_LABELS:
        raise ApiError(
            "Select a valid order status.",
            422,
            {"status": "Unknown status."},
        )

    permissions = permissions_for(user.role.name)
    can_approve = "orders:approve" in permissions
    can_cancel_own = (
        "orders:create" in permissions
        and status == "Cancelled"
        and order.retailer_id == user.retailer_id
        and order.status in CANCELLABLE
    )
    if not can_approve and not can_cancel_own:
        raise ApiError("You do not have permission to perform this action.", 403)

    if status not in TRANSITIONS.get(order.status, set()):
        raise ApiError(
            f"Order {order.id} cannot move from {order.status} to {status}.",
            422,
            {"status": f"Invalid transition from {order.status}."},
        )

    previous_status = order.status
    restored_units = 0
    if status == "Cancelled":
        for item in order.items:
            for allocation in item.allocations:
                batch = allocation.batch
                if batch is None:
                    continue
                if batch.inventory is None:
                    batch.inventory = Inventory(batch=batch, quantity=0)
                    db.session.flush()
                batch.inventory.quantity += allocation.quantity
                restored_units += allocation.quantity
                add_movement(
                    item.medicine,
                    batch,
                    "Return",
                    allocation.quantity,
                    f"{order.id} cancelled",
                    user.name,
                )
        if order.invoice:
            order.invoice.payment_status = "Cancelled"

    order.status = status
    db.session.add(
        OrderEvent(
            order=order,
            label=STATUS_LABELS[status],
            timestamp=utcnow(),
            done=True,
        )
    )
    add_activity(
        "order" if status == "Cancelled" else "approval",
        f"Order {order.id} marked {status.lower()}",
        f"{order.retailer_record.name if order.retailer_record else 'Retailer'} - INR {float(order.total_amount):,.0f}",
        user.name,
    )
    db.session.commit()
    log_event(
        current_app.logger,
        "order.status_changed",
        level=logging.INFO,
        order_id=order.id,
        from_status=previous_status,
        to_status=status,
        restored_units=restored_units,
        total_amount=float(order.total_amount),
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify(order_to_dict(order))


@retailers_bp.get("")
@jwt_required()
def list_retailers():
    user = load_current_user()
    query = Retailer.query
    if user.role.name == "retailer":
        query = query.filter(Retailer.id == user.retailer_id)
    retailers = query.order_by(Retailer.id.asc()).all()
    return jsonify([retailer_to_dict(retailer) for retailer in retailers])
