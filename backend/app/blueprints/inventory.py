from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from ..errors import ApiError
from ..extensions import db
from ..logging_config import log_event
from ..models import Batch, Inventory, StockMovement
from ..permissions import load_current_user, require_permission
from ..serializers import inventory_rows, movement_to_dict
from ..utils import add_activity, add_movement, next_business_id, parse_int

inventory_bp = Blueprint("inventory", __name__, url_prefix="/inventory")


@inventory_bp.get("")
@jwt_required()
def list_inventory():
    load_current_user()
    return jsonify(inventory_rows())


@inventory_bp.get("/summary")
@jwt_required()
def inventory_summary():
    load_current_user()
    rows = inventory_rows()
    return jsonify(
        {
            "totalBatches": len(rows),
            "totalUnits": sum(row["quantity"] for row in rows),
            "inventoryValue": round(sum(row["stockValue"] for row in rows), 2),
            "lowStockCount": sum(1 for row in rows if row["status"] == "Low stock"),
            "nearExpiryCount": sum(1 for row in rows if row["status"] == "Near expiry"),
            "outOfStockCount": sum(1 for row in rows if row["status"] == "Out of stock"),
        }
    )


@inventory_bp.get("/movements")
@jwt_required()
def list_movements():
    load_current_user()
    movements = (
        StockMovement.query.order_by(
            StockMovement.date.desc(), StockMovement.created_at.desc(), StockMovement.id.desc()
        )
        .limit(200)
        .all()
    )
    return jsonify([movement_to_dict(movement) for movement in movements])


@inventory_bp.post("/batches/<batch_id>/adjust")
@require_permission("inventory:write")
def adjust_stock(batch_id):
    user = load_current_user()
    payload = request.get_json(silent=True) or {}
    delta = parse_int(payload.get("delta"), "delta")
    if delta == 0:
        raise ApiError(
            "Enter a non-zero adjustment quantity.",
            422,
            {"delta": "Delta must not be zero."},
        )
    reason = str(payload.get("reason") or "").strip()
    if not reason:
        raise ApiError(
            "Select a reason for the adjustment.",
            422,
            {"reason": "A reason is required."},
        )

    batch = db.session.get(Batch, batch_id)
    if batch is None or batch.medicine is None or not batch.medicine.is_active:
        raise ApiError("Batch not found.", 404)

    inventory = batch.inventory
    if inventory is None:
        inventory = Inventory(batch=batch, quantity=0)
        db.session.add(inventory)
        db.session.flush()

    next_quantity = inventory.quantity + delta
    if next_quantity < 0:
        raise ApiError(
            f"Adjustment rejected: only {inventory.quantity} units are on hand in this batch.",
            422,
            {"delta": f"At most {inventory.quantity} units can be removed."},
        )

    inventory.quantity = next_quantity
    movement_type = "Inbound" if delta > 0 else "Adjustment"
    reference = next_business_id("adjustment", "ADJ", 113)
    add_movement(
        batch.medicine,
        batch,
        movement_type,
        delta,
        reference,
        user.name,
    )
    add_activity(
        "inventory",
        f"Stock adjusted: {batch.medicine.name} {batch.medicine.strength}",
        f"{'+' if delta > 0 else ''}{delta} units - {reason}",
        user.name,
    )
    db.session.commit()
    log_event(
        current_app.logger,
        "inventory.adjusted",
        batch_id=batch.id,
        medicine_id=batch.medicine.id,
        delta=delta,
        previous_quantity=next_quantity - delta,
        new_quantity=next_quantity,
        movement_type=movement_type,
        reference=reference,
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify(inventory_rows())
