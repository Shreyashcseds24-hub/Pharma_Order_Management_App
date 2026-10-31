from datetime import date

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from ..errors import ApiError
from ..extensions import db
from ..logging_config import log_event
from ..models import Batch, Category, Inventory, Medicine, Supplier
from ..permissions import load_current_user, require_permission
from ..serializers import medicine_to_dict
from ..utils import (
    add_activity,
    add_movement,
    money,
    next_business_id,
    parse_date,
    parse_decimal,
    parse_int,
)

medicines_bp = Blueprint("medicines", __name__, url_prefix="/medicines")

DEFAULT_WAREHOUSE = "Chennai Central WH"


def _text(payload, key, label, *, max_length=120, required=True, default=None):
    value = payload.get(key)
    if value is None or str(value).strip() == "":
        if required:
            raise ApiError(
                f"{label} is required.", 422, {key: f"{label} is required."}
            )
        return default
    value = str(value).strip()
    if len(value) > max_length:
        raise ApiError(
            f"{label} is too long.", 422, {key: f"Use at most {max_length} characters."}
        )
    return value


def _category(name):
    category = Category.query.filter(db.func.lower(Category.name) == name.lower()).first()
    if category is None:
        category = Category(name=name)
        db.session.add(category)
        db.session.flush()
    return category


def _supplier(name):
    if not name:
        return None
    supplier = Supplier.query.filter(db.func.lower(Supplier.name) == name.lower()).first()
    if supplier is None:
        supplier = Supplier(name=name)
        db.session.add(supplier)
        db.session.flush()
    return supplier


def _get_medicine(medicine_id):
    medicine = db.session.get(Medicine, medicine_id)
    if medicine is None or not medicine.is_active:
        raise ApiError("Medicine not found.", 404)
    return medicine


@medicines_bp.get("")
@jwt_required()
def list_medicines():
    load_current_user()
    medicines = (
        Medicine.query.filter(Medicine.is_active.is_(True))
        .order_by(Medicine.name.asc())
        .all()
    )
    return jsonify([medicine_to_dict(medicine) for medicine in medicines])


@medicines_bp.get("/<medicine_id>")
@jwt_required()
def get_medicine(medicine_id):
    load_current_user()
    return jsonify(medicine_to_dict(_get_medicine(medicine_id)))


@medicines_bp.post("")
@require_permission("catalog:write")
def create_medicine():
    payload = request.get_json(silent=True) or {}

    name = _text(payload, "name", "Medicine name")
    brand = _text(payload, "brand", "Brand")
    strength = _text(payload, "strength", "Strength", max_length=60)
    dosage_form = _text(payload, "dosageForm", "Dosage form", max_length=40, required=False, default="Tablet")
    pack_size = _text(payload, "packSize", "Pack size")
    category_name = _text(payload, "category", "Category", max_length=80, required=False, default="General")
    supplier_name = _text(payload, "supplier", "Supplier", required=False, default="")
    unit_price = parse_decimal(payload.get("unitPrice"), "unitPrice", minimum=0.01)
    reorder_level = parse_int(payload.get("reorderLevel"), "reorderLevel", minimum=0, default=0)

    medicine = Medicine(
        id=next_business_id("medicine", "MED", 0, width=3),
        name=name,
        brand=brand,
        strength=strength,
        dosage_form=dosage_form,
        pack_size=pack_size,
        category=_category(category_name),
        supplier=_supplier(supplier_name),
        unit_price=money(unit_price),
        reorder_level=reorder_level,
        requires_prescription=category_name in ("Antibiotic", "Oncology"),
        is_active=True,
        is_sample=bool(payload.get("isSample", False)),
    )
    db.session.add(medicine)
    db.session.flush()

    batch_number = _text(payload, "batchNumber", "Batch number", max_length=60, required=False, default="")
    batch = None
    quantity = 0
    if batch_number:
        expiry = parse_date(payload.get("expiryDate"), "expiryDate", allow_past=False)
        quantity = parse_int(payload.get("quantity"), "quantity", minimum=0, default=0)
        cost_price = parse_decimal(
            payload.get("costPrice"),
            "costPrice",
            minimum=0,
            default=float(unit_price) * 0.78,
        )
        batch = Batch(
            id=next_business_id("batch", "BATCH", 4300),
            medicine=medicine,
            batch_number=batch_number,
            expiry_date=expiry,
            received_date=date.today(),
            cost_price=money(cost_price),
            supplier=medicine.supplier,
            warehouse=payload.get("warehouse") or DEFAULT_WAREHOUSE,
        )
        db.session.add(batch)
        db.session.flush()
        db.session.add(Inventory(batch_id=batch.id, quantity=quantity))
        if quantity > 0:
            add_movement(
                medicine,
                batch,
                "Inbound",
                quantity,
                f"GRN-{batch_number}",
                load_current_user().name,
            )

    add_activity(
        "inventory",
        f"New medicine added: {medicine.name}",
        f"{medicine.brand} - {medicine.strength}",
        load_current_user().name,
    )
    db.session.commit()
    user = load_current_user()
    log_event(
        current_app.logger,
        "medicine.created",
        medicine_id=medicine.id,
        user_id=user.id,
        role=user.role.name,
    )
    if batch is not None and quantity > 0:
        log_event(
            current_app.logger,
            "inventory.received",
            medicine_id=medicine.id,
            batch_id=batch.id,
            quantity=quantity,
            reference=f"GRN-{batch.batch_number}",
            user_id=user.id,
            role=user.role.name,
        )
    return jsonify(medicine_to_dict(medicine)), 201


@medicines_bp.put("/<medicine_id>")
@require_permission("catalog:write")
def update_medicine(medicine_id):
    medicine = _get_medicine(medicine_id)
    payload = request.get_json(silent=True) or {}

    if "name" in payload:
        medicine.name = _text(payload, "name", "Medicine name")
    if "brand" in payload:
        medicine.brand = _text(payload, "brand", "Brand")
    if "strength" in payload:
        medicine.strength = _text(payload, "strength", "Strength", max_length=60)
    if "dosageForm" in payload:
        medicine.dosage_form = _text(payload, "dosageForm", "Dosage form", max_length=40)
    if "packSize" in payload:
        medicine.pack_size = _text(payload, "packSize", "Pack size")
    if "category" in payload:
        medicine.category = _category(_text(payload, "category", "Category", max_length=80))
    if "supplier" in payload:
        supplier_name = _text(payload, "supplier", "Supplier", required=False, default="")
        medicine.supplier = _supplier(supplier_name)
    if "unitPrice" in payload:
        medicine.unit_price = money(parse_decimal(payload.get("unitPrice"), "unitPrice", minimum=0.01))
    if "reorderLevel" in payload:
        medicine.reorder_level = parse_int(payload.get("reorderLevel"), "reorderLevel", minimum=0)
    if "requiresPrescription" in payload:
        medicine.requires_prescription = bool(payload.get("requiresPrescription"))

    add_activity(
        "inventory",
        f"Medicine updated: {medicine.name}",
        "Catalog details were edited",
        load_current_user().name,
    )
    db.session.commit()
    user = load_current_user()
    log_event(
        current_app.logger,
        "medicine.updated",
        medicine_id=medicine.id,
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify(medicine_to_dict(medicine))


@medicines_bp.delete("/<medicine_id>")
@require_permission("catalog:write")
def delete_medicine(medicine_id):
    medicine = _get_medicine(medicine_id)
    medicine.is_active = False
    add_activity(
        "inventory",
        f"Medicine removed: {medicine.name}",
        "Catalog entry archived (historical orders retained)",
        load_current_user().name,
    )
    db.session.commit()
    user = load_current_user()
    log_event(
        current_app.logger,
        "medicine.archived",
        medicine_id=medicine.id,
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify({"ok": True})
