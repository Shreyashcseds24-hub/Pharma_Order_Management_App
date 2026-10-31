"""Serialisation helpers that preserve the exact frontend contracts."""

from datetime import date

from .models import Batch, Medicine
from .permissions import permissions_for
from .utils import json_date, json_datetime

NEAR_EXPIRY_DAYS = 90


def user_to_dict(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.name,
        "title": user.title or "",
        "initials": user.initials or "",
        "permissions": permissions_for(user.role.name),
        "retailerId": user.retailer_id,
    }


def retailer_to_dict(retailer):
    return {
        "id": retailer.id,
        "name": retailer.name,
        "city": retailer.city or "",
        "contact": retailer.contact or "",
        "phone": retailer.phone or "",
    }


def batch_quantity(batch):
    return batch.inventory.quantity if batch.inventory else 0


def days_until(expiry_date):
    if expiry_date is None:
        return 0
    if isinstance(expiry_date, str):
        try:
            expiry_date = date.fromisoformat(expiry_date[:10])
        except ValueError:
            return 0
    return (expiry_date - date.today()).days


def availability_for(available_quantity, reorder_level):
    if available_quantity <= 0:
        return "Out of stock"
    if available_quantity <= reorder_level:
        return "Low stock"
    return "In stock"


def stock_status(quantity, reorder_level, expiry_date):
    if quantity <= 0:
        return "Out of stock"
    if days_until(expiry_date) <= NEAR_EXPIRY_DAYS:
        return "Near expiry"
    if quantity <= reorder_level:
        return "Low stock"
    return "Healthy"


def batch_to_dict(batch):
    return {
        "id": batch.id,
        "batchNumber": batch.batch_number,
        "expiryDate": json_date(batch.expiry_date),
        "quantity": batch_quantity(batch),
        "supplier": batch.supplier.name if batch.supplier else "Unassigned",
        "receivedDate": json_date(batch.received_date),
        "costPrice": float(batch.cost_price),
        "warehouse": batch.warehouse,
    }


def medicine_to_dict(medicine, *, include_batches=True):
    batches = sorted(medicine.batches, key=lambda row: row.expiry_date)
    available = sum(batch_quantity(batch) for batch in batches)
    primary_expiry = batches[0].expiry_date.isoformat() if batches else None
    payload = {
        "id": medicine.id,
        "name": medicine.name,
        "brand": medicine.brand,
        "strength": medicine.strength,
        "dosageForm": medicine.dosage_form,
        "packSize": medicine.pack_size,
        "category": medicine.category.name if medicine.category else "",
        "unitPrice": float(medicine.unit_price),
        "supplier": medicine.supplier.name if medicine.supplier else "Unassigned",
        "reorderLevel": medicine.reorder_level,
        "batches": [batch_to_dict(batch) for batch in batches] if include_batches else [],
        "availableQuantity": available,
        "primaryExpiryDate": primary_expiry,
        "requiresPrescription": medicine.requires_prescription,
        "isSample": medicine.is_sample,
        "availability": availability_for(available, medicine.reorder_level),
    }
    return payload


def inventory_row_to_dict(batch):
    medicine = batch.medicine
    quantity = batch_quantity(batch)
    cost_value = float(batch.cost_price) * quantity
    retail_value = float(medicine.unit_price) * quantity
    return {
        "id": batch.id,
        "medicineId": medicine.id,
        "medicine": f"{medicine.name} {medicine.strength}",
        "brand": medicine.brand,
        "batchNumber": batch.batch_number,
        "quantity": quantity,
        "reorderLevel": medicine.reorder_level,
        "expiryDate": json_date(batch.expiry_date),
        "daysToExpiry": days_until(batch.expiry_date),
        "supplier": batch.supplier.name if batch.supplier else "Unassigned",
        "costPrice": float(batch.cost_price),
        "stockValue": round(cost_value, 2),
        "retailValue": round(retail_value, 2),
        "status": stock_status(quantity, medicine.reorder_level, batch.expiry_date),
        "canAdjust": True,
        "warehouse": batch.warehouse,
    }


def inventory_rows():
    rows = (
        Batch.query.join(Medicine, Batch.medicine_id == Medicine.id)
        .filter(Medicine.is_active.is_(True))
        .all()
    )
    payload = [inventory_row_to_dict(batch) for batch in rows]
    payload.sort(key=lambda row: (row["medicine"].lower(), row["batchNumber"].lower()))
    return payload


def movement_to_dict(movement):
    return {
        "id": movement.id,
        "date": json_date(movement.date),
        "medicineId": movement.medicine_id,
        "medicine": (
            f"{movement.medicine.name} {movement.medicine.strength}"
            if movement.medicine
            else "Unknown medicine"
        ),
        "type": movement.type,
        "quantity": movement.quantity,
        "reference": movement.reference,
        "user": movement.user,
    }


def activity_to_dict(activity):
    return {
        "id": activity.id,
        "type": activity.type,
        "title": activity.title,
        "detail": activity.detail,
        "time": json_date(activity.time),
        "actor": activity.actor,
    }


def notification_to_dict(notification):
    return {
        "id": notification.id,
        "title": notification.title,
        "detail": notification.detail,
        "time": json_date(notification.time),
        "tone": notification.tone,
        "read": notification.read,
    }


def order_item_to_dict(item):
    return {
        "id": item.id,
        "medicineId": item.medicine_id,
        "name": item.name,
        "brand": item.brand,
        "packSize": item.pack_size,
        "quantity": item.quantity,
        "unitPrice": float(item.unit_price),
        "lineTotal": float(item.line_total),
    }


def order_to_dict(order):
    items = [order_item_to_dict(item) for item in order.items]
    total_quantity = sum(item["quantity"] for item in items)
    return {
        "id": order.id,
        "retailerId": order.retailer_id,
        "retailer": order.retailer_record.name if order.retailer_record else "",
        "orderDate": json_date(order.order_date),
        "status": order.status,
        "items": items,
        "itemCount": len(items),
        "totalQuantity": total_quantity,
        "totalAmount": float(order.total_amount),
        "paymentTerms": order.payment_terms,
        "warehouse": order.warehouse,
        "timeline": [
            {
                "label": event.label,
                "timestamp": json_datetime(event.timestamp),
                "done": event.done,
            }
            for event in sorted(order.timeline, key=lambda row: row.timestamp)
        ],
    }


def invoice_to_dict(invoice):
    return {
        "id": invoice.id,
        "invoiceNumber": invoice.invoice_number,
        "orderId": invoice.order_id,
        "retailer": invoice.retailer_record.name if invoice.retailer_record else "",
        "invoiceDate": json_date(invoice.invoice_date),
        "dueDate": json_date(invoice.due_date),
        "totalAmount": float(invoice.total_amount),
        "taxAmount": float(invoice.tax_amount),
        "grandTotal": round(float(invoice.total_amount) + float(invoice.tax_amount), 2),
        "paymentStatus": invoice.payment_status,
        "paidOn": json_date(invoice.paid_on),
    }


def invoice_detail_to_dict(invoice):
    payload = invoice_to_dict(invoice)
    payload["items"] = [
        order_item_to_dict(item) for item in invoice.order.items
    ] if invoice.order else []
    payload["retailerRecord"] = (
        retailer_to_dict(invoice.retailer_record) if invoice.retailer_record else None
    )
    payload["warehouse"] = invoice.order.warehouse if invoice.order else ""
    return payload
