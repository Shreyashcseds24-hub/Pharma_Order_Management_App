"""Role definitions and backend-enforced permissions."""

from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from .errors import ApiError

ROLES = ("admin", "distributor", "retailer")

ROLE_LABELS = {
    "admin": "Administrator",
    "distributor": "Distributor",
    "retailer": "Retailer",
}

ROLE_PERMISSIONS = {
    "admin": ["catalog:write", "inventory:write", "orders:approve", "reports:view", "settings:write"],
    "distributor": ["catalog:write", "inventory:write", "orders:approve", "reports:view"],
    "retailer": ["orders:create", "reports:view"],
}


def permissions_for(role_name):
    return list(ROLE_PERMISSIONS.get(role_name, []))


def load_current_user():
    """Return the authenticated user, loading it once per request."""
    user = getattr(g, "current_user", None)
    if user is not None:
        return user

    from .models import User

    identity = get_jwt_identity()
    user = User.query.get(identity) if identity else None
    if user is None or not user.is_active:
        raise ApiError("Your session is no longer valid. Please sign in again.", 401)
    g.current_user = user
    return user


def require_permission(permission):
    """Decorator enforcing both a valid JWT and a specific permission."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = load_current_user()
            if permission not in permissions_for(user.role.name):
                raise ApiError("You do not have permission to perform this action.", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_roles(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = load_current_user()
            if user.role.name not in roles:
                raise ApiError("You do not have permission to perform this action.", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
