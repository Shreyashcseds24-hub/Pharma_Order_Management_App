"""Read-only analytics queries shared by the HTTP API and the AI tools.

The functions in this module were extracted from
``app.blueprints.analytics`` so that the existing analytics endpoints and the
LLM tool layer use exactly the same calculations. They only read from the
database; nothing here mutates business data.

Retailer scoping is applied by :func:`order_query` and by the aggregate helpers
that accept a ``user`` argument.
"""

from datetime import date, timedelta
from math import ceil

from sqlalchemy import func

from ..extensions import db
from ..models import Batch, Medicine, Order, OrderItem
from ..utils import day_bounds, json_date

REPORT_STATUSES = (
    "Pending",
    "Approved",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
)
# Statuses that count as demand/sales in the existing analytics endpoints.
SALES_STATUSES = ("Pending", "Approved", "Processing", "Shipped", "Delivered")
# Statuses that represent fulfilled sales (used for top-selling rankings).
FULFILLED_STATUSES = ("Shipped", "Delivered")


def order_query(user=None):
    """Return an Order query scoped to the current user's retailer when needed."""
    query = Order.query
    if user is not None and user.role.name == "retailer":
        query = query.filter(Order.retailer_id == user.retailer_id)
    return query


def daily_series(user, days):
    start = date.today() - timedelta(days=days - 1)
    orders = (
        order_query(user)
        .filter(Order.order_date >= start, Order.status.in_(SALES_STATUSES))
        .all()
    )
    by_date = {}
    for order in orders:
        bucket = by_date.setdefault(
            order.order_date,
            {"date": json_date(order.order_date), "revenue": 0.0, "orders": 0, "units": 0},
        )
        bucket["revenue"] += float(order.total_amount)
        bucket["orders"] += 1
        bucket["units"] += sum(item.quantity for item in order.items)

    series = []
    for day in day_bounds(days):
        key = json_date(day)
        row = by_date.get(day)
        if row:
            series.append(
                {
                    "date": key,
                    "revenue": round(row["revenue"], 2),
                    "orders": row["orders"],
                    "units": row["units"],
                }
            )
        else:
            series.append({"date": key, "revenue": 0.0, "orders": 0, "units": 0})
    return series


def total_available(medicine):
    """Usable (non-expired) units across all batches of a medicine."""
    today = date.today()
    return sum(
        batch.inventory.quantity
        for batch in medicine.batches
        if batch.inventory is not None and batch.expiry_date >= today
    )


def avg_daily_units(user=None, days=30):
    start = date.today() - timedelta(days=days - 1)
    query = (
        db.session.query(OrderItem.medicine_id, func.sum(OrderItem.quantity))
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.order_date >= start,
            Order.status.in_(SALES_STATUSES),
            OrderItem.medicine_id.isnot(None),
        )
    )
    if user is not None and user.role.name == "retailer":
        query = query.filter(Order.retailer_id == user.retailer_id)
    rows = query.group_by(OrderItem.medicine_id).all()
    return {medicine_id: (int(units or 0) / days) for medicine_id, units in rows}


def units_last_days(user, days):
    start = date.today() - timedelta(days=days - 1)
    query = (
        db.session.query(OrderItem.medicine_id, func.sum(OrderItem.quantity))
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.order_date >= start,
            Order.status.in_(SALES_STATUSES),
            OrderItem.medicine_id.isnot(None),
        )
    )
    if user is not None and user.role.name == "retailer":
        query = query.filter(Order.retailer_id == user.retailer_id)
    rows = query.group_by(OrderItem.medicine_id).all()
    return {medicine_id: int(units or 0) for medicine_id, units in rows}


def lower_stock_medicines():
    medicines = Medicine.query.filter(Medicine.is_active.is_(True)).all()
    rows = []
    for medicine in medicines:
        available = total_available(medicine)
        if available <= medicine.reorder_level:
            rows.append((medicine, available))
    rows.sort(key=lambda pair: (pair[1] / max(pair[0].reorder_level, 1), pair[1]))
    return rows


def recommendations(user, horizon):
    averages = avg_daily_units(user)
    medicines = Medicine.query.filter(Medicine.is_active.is_(True)).all()
    scored = []
    for medicine in medicines:
        available = total_available(medicine)
        daily = averages.get(medicine.id, 0.0)
        target = max(medicine.reorder_level, ceil(daily * horizon))
        suggested = max(0, ceil(target - available))
        days_cover = (available / daily) if daily > 0 else (999 if available > 0 else 0)
        if suggested <= 0 and days_cover > horizon:
            continue
        if available <= medicine.reorder_level * 0.5 or days_cover <= 7:
            urgency = "critical"
        elif available <= medicine.reorder_level or days_cover <= 14:
            urgency = "high"
        elif days_cover <= horizon:
            urgency = "medium"
        else:
            urgency = "low"
        confidence = min(92, max(58, 60 + int(min(daily, 40) * 0.8)))
        if daily > 0:
            reason = (
                f"Average issues are {daily:.1f} units/day. Current usable stock covers "
                f"{days_cover:.0f} days against a {horizon}-day planning horizon; "
                f"{suggested} units would restore cover above the reorder level."
            )
        else:
            reason = (
                f"Stock is at or below the reorder level ({medicine.reorder_level} units) "
                f"and no recent issues were recorded. {suggested} units are suggested to restore buffer."
            )
        scored.append(
            {
                "id": f"REC-{medicine.id}",
                "medicineId": medicine.id,
                "title": f"{medicine.name} {medicine.strength}",
                "suggestedQuantity": suggested,
                "currentStock": available,
                "reorderLevel": medicine.reorder_level,
                "urgency": urgency,
                "confidence": confidence,
                "reason": reason,
                "_daysCover": days_cover,
            }
        )
    scored.sort(key=lambda row: (row["_daysCover"], -row["suggestedQuantity"]))
    return scored


def stockout_risk(user):
    averages = avg_daily_units(user)
    medicines = Medicine.query.filter(Medicine.is_active.is_(True)).all()
    rows = []
    for medicine in medicines:
        daily = averages.get(medicine.id, 0.0)
        if daily <= 0:
            continue
        available = total_available(medicine)
        days = int(available / daily)
        if days <= 7:
            risk = "critical"
        elif days <= 14:
            risk = "high"
        elif days <= 30:
            risk = "medium"
        else:
            risk = "low"
        if risk == "low":
            continue
        rows.append(
            {
                "medicineId": medicine.id,
                "name": f"{medicine.name} {medicine.strength}",
                "daysToStockout": days,
                "risk": risk,
            }
        )
    rows.sort(key=lambda row: row["daysToStockout"])
    return rows


def expiry_risk(days=90):
    """Batches expiring within ``days`` days (including already expired batches)."""
    horizon = date.today() + timedelta(days=days)
    rows = []
    for batch in Batch.query.filter(Batch.expiry_date <= horizon).all():
        medicine = batch.medicine
        if medicine is None or not medicine.is_active:
            continue
        quantity = batch.inventory.quantity if batch.inventory else 0
        if quantity <= 0:
            continue
        rows.append(
            {
                "id": batch.id,
                "medicineId": medicine.id,
                "name": f"{medicine.name} {medicine.strength}",
                "batchNumber": batch.batch_number,
                "quantity": quantity,
                "expiryDate": json_date(batch.expiry_date),
                "daysLeft": (batch.expiry_date - date.today()).days,
                "valueAtRisk": round(quantity * float(batch.cost_price), 2),
            }
        )
    rows.sort(key=lambda row: row["daysLeft"])
    return rows


def inventory_summary():
    """Aggregate inventory KPIs across active medicines and all batches."""
    today = date.today()
    near_expiry_horizon = today + timedelta(days=90)
    medicines = Medicine.query.filter(Medicine.is_active.is_(True)).all()

    total_units = 0
    usable_units = 0
    batch_count = 0
    cost_value = 0.0
    retail_value = 0.0
    expired_units = 0
    expired_value = 0.0
    near_expiry_batches = 0
    low_stock = 0
    out_of_stock = 0

    for medicine in medicines:
        available = total_available(medicine)
        usable_units += available
        if available <= 0:
            out_of_stock += 1
        elif available <= medicine.reorder_level:
            low_stock += 1

        for batch in medicine.batches:
            quantity = batch.inventory.quantity if batch.inventory else 0
            batch_count += 1
            total_units += quantity
            cost_value += quantity * float(batch.cost_price)
            retail_value += quantity * float(medicine.unit_price)
            if batch.expiry_date < today:
                expired_units += quantity
                expired_value += quantity * float(batch.cost_price)
            elif batch.expiry_date <= near_expiry_horizon:
                near_expiry_batches += 1

    return {
        "activeMedicines": len(medicines),
        "batchCount": batch_count,
        "totalUnitsOnHand": total_units,
        "usableUnits": usable_units,
        "lowStockMedicines": low_stock,
        "outOfStockMedicines": out_of_stock,
        "nearExpiryBatches90d": near_expiry_batches,
        "expiredUnits": expired_units,
        "inventoryCostValue": round(cost_value, 2),
        "inventoryRetailValue": round(retail_value, 2),
        "expiredValue": round(expired_value, 2),
        "asOf": json_date(today),
    }


def compact_order(order):
    return {
        "id": order.id,
        "retailerId": order.retailer_id,
        "retailer": order.retailer_record.name if order.retailer_record else "",
        "orderDate": json_date(order.order_date),
        "status": order.status,
        "itemCount": len(order.items),
        "totalQuantity": sum(item.quantity for item in order.items),
        "totalAmount": round(float(order.total_amount), 2),
        "warehouse": order.warehouse,
    }


def order_summary(user, days=30, status=None):
    start = date.today() - timedelta(days=days - 1)
    query = order_query(user).filter(Order.order_date >= start)
    if status:
        query = query.filter(Order.status == status)
    orders = query.order_by(Order.order_date.desc(), Order.id.desc()).all()

    by_status = {}
    for order in orders:
        by_status[order.status] = by_status.get(order.status, 0) + 1

    return {
        "days": days,
        "statusFilter": status,
        "orderCount": len(orders),
        "totalValue": round(sum(float(order.total_amount) for order in orders), 2),
        "totalUnits": sum(sum(item.quantity for item in order.items) for order in orders),
        "byStatus": by_status,
        "orders": [compact_order(order) for order in orders[:20]],
        "truncated": len(orders) > 20,
    }


def sales_summary(user, days=30, compare_previous=False):
    today = date.today()
    start = today - timedelta(days=days - 1)
    orders = (
        order_query(user)
        .filter(Order.order_date >= start, Order.status.in_(SALES_STATUSES))
        .all()
    )
    revenue = sum(float(order.total_amount) for order in orders)
    units = sum(sum(item.quantity for item in order.items) for order in orders)
    result = {
        "days": days,
        "periodStart": json_date(start),
        "periodEnd": json_date(today),
        "orders": len(orders),
        "units": units,
        "revenue": round(revenue, 2),
        "averageOrderValue": round(revenue / len(orders), 2) if orders else 0,
        "daily": daily_series(user, days),
    }

    if compare_previous:
        previous_end = start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=days - 1)
        previous_orders = (
            order_query(user)
            .filter(
                Order.order_date >= previous_start,
                Order.order_date <= previous_end,
                Order.status.in_(SALES_STATUSES),
            )
            .all()
        )
        previous_revenue = sum(float(order.total_amount) for order in previous_orders)
        previous_units = sum(
            sum(item.quantity for item in order.items) for order in previous_orders
        )
        change = (
            round(((revenue - previous_revenue) / previous_revenue) * 100, 1)
            if previous_revenue
            else None
        )
        result["previousPeriod"] = {
            "periodStart": json_date(previous_start),
            "periodEnd": json_date(previous_end),
            "orders": len(previous_orders),
            "units": previous_units,
            "revenue": round(previous_revenue, 2),
        }
        result["revenueChangePercent"] = change

    return result


def top_selling_medicines(user, days=30, limit=10):
    start = date.today() - timedelta(days=days - 1)
    query = (
        db.session.query(
            OrderItem.medicine_id,
            func.sum(OrderItem.quantity).label("units"),
            func.sum(OrderItem.line_total).label("revenue"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.order_date >= start,
            Order.status.in_(FULFILLED_STATUSES),
            OrderItem.medicine_id.isnot(None),
        )
    )
    if user is not None and user.role.name == "retailer":
        query = query.filter(Order.retailer_id == user.retailer_id)
    rows = (
        query.group_by(OrderItem.medicine_id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )

    medicine_ids = [row[0] for row in rows]
    medicines = {
        medicine.id: medicine
        for medicine in Medicine.query.filter(Medicine.id.in_(medicine_ids)).all()
    }
    payload = []
    for medicine_id, units, revenue in rows:
        medicine = medicines.get(medicine_id)
        payload.append(
            {
                "medicineId": medicine_id,
                "name": (
                    f"{medicine.name} {medicine.strength}"
                    if medicine
                    else medicine_id or "Unknown medicine"
                ),
                "brand": medicine.brand if medicine else "",
                "units": int(units or 0),
                "revenue": round(float(revenue or 0), 2),
            }
        )
    return payload


def pending_orders(user, limit=10):
    orders = (
        order_query(user)
        .filter(Order.status == "Pending")
        .order_by(Order.order_date.desc(), Order.id.desc())
        .limit(limit)
        .all()
    )
    return [compact_order(order) for order in orders]
