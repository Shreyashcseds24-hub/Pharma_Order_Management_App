from datetime import date

from flask import Blueprint, jsonify

from ..errors import ApiError
from ..extensions import db
from ..models import Invoice
from ..permissions import load_current_user, require_roles
from ..serializers import invoice_detail_to_dict, invoice_to_dict
from ..utils import add_activity

invoices_bp = Blueprint("invoices", __name__, url_prefix="/invoices")


def _get_invoice(invoice_id):
    invoice = db.session.get(Invoice, invoice_id)
    if invoice is None:
        raise ApiError("Invoice not found.", 404)
    return invoice


@invoices_bp.get("")
@require_roles("admin", "distributor")
def list_invoices():
    invoices = Invoice.query.order_by(
        Invoice.invoice_date.desc(), Invoice.id.desc()
    ).all()
    return jsonify([invoice_to_dict(invoice) for invoice in invoices])


@invoices_bp.get("/<invoice_id>")
@require_roles("admin", "distributor")
def get_invoice(invoice_id):
    return jsonify(invoice_detail_to_dict(_get_invoice(invoice_id)))


@invoices_bp.post("/<invoice_id>/payment")
@require_roles("admin", "distributor")
def record_payment(invoice_id):
    user = load_current_user()
    invoice = _get_invoice(invoice_id)
    if invoice.payment_status == "Cancelled":
        raise ApiError("Cancelled invoices cannot be paid.", 422)
    if invoice.payment_status == "Paid":
        return jsonify(invoice_to_dict(invoice))

    invoice.payment_status = "Paid"
    invoice.paid_on = date.today()
    add_activity(
        "approval",
        f"Payment recorded for {invoice.id}",
        f"{invoice.invoice_number} - INR {float(invoice.total_amount):,.2f}",
        user.name,
    )
    db.session.commit()
    return jsonify(invoice_to_dict(invoice))
