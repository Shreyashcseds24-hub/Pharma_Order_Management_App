from .auth import auth_bp
from .medicines import medicines_bp
from .inventory import inventory_bp
from .orders import orders_bp
from .invoices import invoices_bp
from .analytics import analytics_bp
from .ai import ai_bp

__all__ = [
    "auth_bp",
    "medicines_bp",
    "inventory_bp",
    "orders_bp",
    "invoices_bp",
    "analytics_bp",
    "ai_bp",
]
