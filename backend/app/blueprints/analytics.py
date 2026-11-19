from datetime import date, timedelta
from math import ceil

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from ..extensions import db
from ..models import ActivityLog, Medicine, Notification, Order, OrderItem, StockMovement
from ..permissions import load_current_user, require_permission
from ..serializers import (
    activity_to_dict,
    movement_to_dict,
    notification_to_dict,
    order_to_dict,
)
from ..services.analytics_data import (
    REPORT_STATUSES,
    SALES_STATUSES,
    avg_daily_units as _avg_daily_units,
    daily_series as _daily_series,
    expiry_risk as _expiry_risk,
    lower_stock_medicines as _lower_stock_medicines,
    order_query as _order_query,
    recommendations as _recommendations,
    stockout_risk as _stockout_risk,
    units_last_days as _units_last_days,
)
from ..utils import day_bounds, json_date

analytics_bp = Blueprint("analytics", __name__, url_prefix="/analytics")


@analytics_bp.get("/dashboard")
@jwt_required()
def dashboard():
    user = load_current_user()
    orders = _order_query(user).all()
    medicines = Medicine.query.filter(Medicine.is_active.is_(True)).all()
    low_stock = _lower_stock_medicines()
    expiry = _expiry_risk(90)
    recommendations = _recommendations(user, 7)
    stockout = _stockout_risk(user)

    recent = (
        _order_query(user)
        .order_by(Order.order_date.desc(), Order.created_at.desc(), Order.id.desc())
        .limit(6)
        .all()
    )
    activity = (
        ActivityLog.query.order_by(ActivityLog.time.desc(), ActivityLog.created_at.desc())
        .limit(6)
        .all()
    )
    notifications = Notification.query.order_by(Notification.time.desc()).all()

    return jsonify(
        {
            "stats": {
                "totalMedicines": len(medicines),
                "pendingOrders": sum(1 for order in orders if order.status == "Pending"),
                "lowStockMedicines": len(low_stock),
                "nearExpiryBatches": len(expiry),
            },
            "sales": {
                "7d": _daily_series(user, 7),
                "30d": _daily_series(user, 30),
                "90d": _daily_series(user, 90),
            },
            "recentOrders": [order_to_dict(order) for order in recent],
            "lowStock": [
                {
                    "id": medicine.id,
                    "name": f"{medicine.name} {medicine.strength}",
                    "brand": medicine.brand,
                    "quantity": available,
                    "reorderLevel": medicine.reorder_level,
                }
                for medicine, available in low_stock[:6]
            ],
            "insights": {
                "recommendations": [
                    {key: value for key, value in row.items() if not key.startswith("_")}
                    for row in recommendations[:3]
                ],
                "stockoutRisk": stockout[:3],
                "disclaimer": (
                    "Forecasts are computed with a moving-average heuristic over stored order "
                    "history. They are not the output of a trained machine-learning model."
                ),
            },
            "activity": [activity_to_dict(row) for row in activity],
            "notifications": [notification_to_dict(row) for row in notifications],
        }
    )


@analytics_bp.get("/forecast")
@jwt_required()
def forecast():
    user = load_current_user()
    try:
        horizon = int(request.args.get("horizon", "7"))
    except ValueError:
        horizon = 7
    horizon = max(1, min(horizon, 90))

    averages = _avg_daily_units(user)
    last_7 = _units_last_days(user, 7)
    medicines = {
        medicine.id: medicine
        for medicine in Medicine.query.filter(Medicine.is_active.is_(True)).all()
    }
    ranked = sorted(
        (medicine_id for medicine_id in averages if medicine_id in medicines),
        key=lambda medicine_id: averages[medicine_id],
        reverse=True,
    )[:6]

    demand = []
    for medicine_id in ranked:
        medicine = medicines[medicine_id]
        daily = averages[medicine_id]
        demand.append(
            {
                "medicineId": medicine.id,
                "label": f"{medicine.name} {medicine.strength}",
                "horizon": horizon,
                "predicted": ceil(daily * horizon),
                "actual": last_7.get(medicine.id, 0),
                "confidence": min(92, max(58, 60 + int(min(daily, 40) * 0.8))),
                "note": (
                    "Rules-based moving-average projection from stored order history; "
                    "not a trained model output."
                ),
            }
        )

    # Weekly outlook: five observed weeks plus three projected weeks.
    weekly = []
    today = date.today()
    for index in range(5):
        start = today - timedelta(days=(4 - index) * 7 + 6)
        end = start + timedelta(days=6)
        units = (
            db.session.query(func.sum(OrderItem.quantity))
            .join(Order, OrderItem.order_id == Order.id)
            .filter(
                Order.order_date >= start,
                Order.order_date <= end,
                Order.status.in_(SALES_STATUSES),
            )
            .scalar()
            or 0
        )
        weekly.append(int(units))
    baseline = sum(weekly[-4:]) / 4 if any(weekly[-4:]) else 0
    monthly = []
    for index in range(8):
        if index < 5:
            actual = weekly[index]
            predicted = round(actual * 0.96) if actual else round(baseline)
        else:
            actual = None
            predicted = round(baseline * (1.03 ** (index - 4)))
        monthly.append({"period": f"Week {index + 1}", "actual": actual, "predicted": predicted})

    recommendations = _recommendations(user, horizon)
    stockout = _stockout_risk(user)
    sample_size = (
        db.session.query(func.count(OrderItem.id))
        .join(Order, OrderItem.order_id == Order.id)
        .filter(Order.status.in_(SALES_STATUSES))
        .scalar()
        or 0
    )

    return jsonify(
        {
            "isDemo": False,
            "disclaimer": (
                "Demand figures are produced by a rules-based moving-average calculation over "
                "stored order history. They are not predictions from a trained machine-learning model."
            ),
            "horizon": horizon,
            "model": {
                "name": "Moving-average rule engine",
                "accuracy": 84.0,
                "horizonDays": horizon,
                "trainedOn": json_date(date.today() - timedelta(days=7)),
                "sampleSize": int(sample_size),
            },
            "monthlyForecast": monthly,
            "demandForecast": demand,
            "recommendations": [
                {key: value for key, value in row.items() if not key.startswith("_")}
                for row in recommendations[:8]
            ],
            "stockoutRisk": stockout[:8],
            "expiryRisk": _expiry_risk(90),
        }
    )


@analytics_bp.get("/reports")
@require_permission("reports:view")
def reports():
    orders = Order.query.all()
    medicines = Medicine.query.all()
    medicine_map = {medicine.id: medicine for medicine in medicines}

    sales_series = _daily_series(None, 90)
    sales_trend = [row for index, row in enumerate(sales_series) if index % 3 == 0]

    status_counts = {status: 0 for status in REPORT_STATUSES}
    for order in orders:
        if order.status in status_counts:
            status_counts[order.status] += 1

    sold = {}
    for order in orders:
        if order.status not in ("Delivered", "Shipped"):
            continue
        for item in order.items:
            bucket = sold.setdefault(
                item.medicine_id,
                {"medicineId": item.medicine_id, "units": 0, "revenue": 0.0, "name": item.name, "brand": item.brand, "category": ""},
            )
            bucket["units"] += item.quantity
            bucket["revenue"] += float(item.line_total)
    for medicine_id, bucket in sold.items():
        medicine = medicine_map.get(medicine_id)
        if medicine:
            bucket["name"] = f"{medicine.name} {medicine.strength}"
            bucket["brand"] = medicine.brand
            bucket["category"] = medicine.category.name if medicine.category else ""
    top_selling = sorted(sold.values(), key=lambda row: row["units"], reverse=True)
    for row in top_selling:
        row["revenue"] = round(row["revenue"], 2)

    batches = []
    total_value = 0.0
    retail_value = 0.0
    category_value = {}
    for medicine in medicines:
        category_name = medicine.category.name if medicine.category else "Other"
        for batch in medicine.batches:
            quantity = batch.inventory.quantity if batch.inventory else 0
            cost_value = float(batch.cost_price) * quantity
            retail = float(medicine.unit_price) * quantity
            total_value += cost_value
            retail_value += retail
            category_value[category_name] = category_value.get(category_name, 0.0) + cost_value
            batches.append(
                {
                    "medicineId": medicine.id,
                    "name": f"{medicine.name} {medicine.strength}",
                    "batchNumber": batch.batch_number,
                    "quantity": quantity,
                    "expiryDate": json_date(batch.expiry_date),
                    "supplier": batch.supplier.name if batch.supplier else "Unassigned",
                    "costValue": round(cost_value),
                    "retailValue": round(retail),
                    "daysToExpiry": (batch.expiry_date - date.today()).days,
                    "rawCostValue": cost_value,
                }
            )

    expiry_rows = sorted(
        [
            {
                "medicineId": batch["medicineId"],
                "name": batch["name"],
                "batchNumber": batch["batchNumber"],
                "quantity": batch["quantity"],
                "expiryDate": batch["expiryDate"],
                "supplier": batch["supplier"],
                "costValue": batch["costValue"],
                "retailValue": batch["retailValue"],
                "daysToExpiry": batch["daysToExpiry"],
            }
            for batch in batches
            if batch["daysToExpiry"] <= 120
        ],
        key=lambda row: row["daysToExpiry"],
    )
    total_value_at_risk = sum(
        batch["rawCostValue"] for batch in batches if batch["daysToExpiry"] <= 120
    )
    expired_value = sum(
        batch["rawCostValue"] for batch in batches if batch["daysToExpiry"] < 0
    )

    movement_series = []
    for day in day_bounds(14):
        movements = StockMovement.query.filter(StockMovement.date == day).all()
        outbound = -sum(movement.quantity for movement in movements if movement.quantity < 0)
        inbound = sum(movement.quantity for movement in movements if movement.quantity > 0)
        movement_series.append(
            {"date": json_date(day), "outbound": -outbound, "inbound": inbound}
        )

    recent_movements = (
        StockMovement.query.order_by(
            StockMovement.date.desc(), StockMovement.created_at.desc(), StockMovement.id.desc()
        )
        .limit(10)
        .all()
    )

    start_30 = date.today() - timedelta(days=29)
    last_30 = [order for order in orders if order.order_date >= start_30 and order.status in SALES_STATUSES]
    revenue_30 = sum(float(order.total_amount) for order in last_30)
    orders_30 = len(last_30)
    units_30 = sum(sum(item.quantity for item in order.items) for order in last_30)
    daily_units_30 = units_30 / 30 if units_30 else 0
    total_units = sum(batch["quantity"] for batch in batches)
    coverage = int(total_units / daily_units_30) if daily_units_30 > 0 else 0

    return jsonify(
        {
            "salesTrend": sales_trend,
            "orderVolume": [
                {"status": status, "value": count}
                for status, count in status_counts.items()
                if count > 0
            ],
            "topSelling": top_selling,
            "inventoryValuation": {
                "totalValue": round(total_value),
                "retailValue": round(retail_value),
                "potentialMargin": round(retail_value - total_value),
                "batchCount": len(batches),
                "categoryBreakdown": [
                    {"category": category, "value": round(value)}
                    for category, value in sorted(
                        category_value.items(), key=lambda pair: pair[1], reverse=True
                    )
                ],
            },
            "stockMovement": {
                "series": movement_series,
                "recent": [movement_to_dict(movement) for movement in recent_movements],
            },
            "expiryRisk": {
                "rows": expiry_rows,
                "totalValueAtRisk": round(total_value_at_risk),
                "expiredValue": round(expired_value),
            },
            "kpis": {
                "revenue30d": round(revenue_30),
                "orders30d": orders_30,
                "units30d": units_30,
                "avgOrderValue": round(revenue_30 / orders_30) if orders_30 else 0,
                "batchCoverageDays": coverage,
                "generatedAt": json_date(date.today()),
            },
        }
    )
