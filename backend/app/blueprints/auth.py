from datetime import datetime, timezone
import logging
import re

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    jwt_required,
)
from werkzeug.security import check_password_hash, generate_password_hash

from ..errors import ApiError
from ..extensions import db
from ..logging_config import log_event
from ..models import Retailer, Role, RevokedToken, User
from ..permissions import load_current_user
from ..serializers import user_to_dict
from ..utils import initials_for, next_business_id

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _session_payload(user):
    token = create_access_token(identity=user.id)
    return {
        "user": user_to_dict(user),
        "token": token,
        "issuedAt": int(datetime.now(timezone.utc).timestamp() * 1000),
    }


def _get_role(name):
    if not name:
        raise ApiError("Select an account role.", 422, {"role": "A role is required."})
    role = Role.query.filter_by(name=str(name).lower()).first()
    if role is None:
        raise ApiError("Unknown account role.", 422, {"role": "Select a valid role."})
    return role


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    requested_role = payload.get("role")

    errors = {}
    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address."
    if not password:
        errors["password"] = "Password is required."
    if errors:
        raise ApiError("Enter your email and password.", 422, errors)

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is None or not check_password_hash(user.password_hash, password):
        log_event(
            current_app.logger,
            "auth.login.failed",
            level=logging.WARNING,
            reason="invalid_credentials",
        )
        raise ApiError("Invalid email or password.", 401)
    if not user.is_active:
        log_event(
            current_app.logger,
            "auth.login.failed",
            level=logging.WARNING,
            reason="disabled_account",
            user_id=user.id,
        )
        raise ApiError("This account has been disabled.", 403)
    if requested_role and str(requested_role).lower() != user.role.name:
        log_event(
            current_app.logger,
            "auth.login.failed",
            level=logging.WARNING,
            reason="role_mismatch",
            user_id=user.id,
            role=user.role.name,
        )
        raise ApiError(
            f"This account is registered as a {user.role.name}.", 403
        )

    log_event(
        current_app.logger,
        "auth.login.succeeded",
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify(_session_payload(user))


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    organisation = str(payload.get("organisation") or "").strip()
    requested_role = str(payload.get("role") or "").strip().lower()

    errors = {}
    if not name:
        errors["name"] = "Full name is required."
    elif len(name) < 3:
        errors["name"] = "Enter at least 3 characters."
    if not email:
        errors["email"] = "Email is required."
    elif not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address."
    if not password:
        errors["password"] = "Password is required."
    elif len(password) < 8:
        errors["password"] = "Use at least 8 characters."
    if not organisation:
        errors["organisation"] = "Organisation name is required."
    if errors:
        raise ApiError("Please correct the highlighted fields.", 422, errors)

    allowed = current_app.config.get("REGISTRATION_ALLOWED_ROLES", [])
    if requested_role not in allowed:
        log_event(
            current_app.logger,
            "auth.register.denied",
            level=logging.WARNING,
            reason="role_not_allowed",
            requested_role=requested_role,
        )
        raise ApiError(
            "Self-registration is not enabled for that role.",
            403,
            {"role": "Choose a permitted role."},
        )

    role = _get_role(requested_role)
    if User.query.filter(db.func.lower(User.email) == email).first():
        raise ApiError("An account with this email already exists.", 409)

    retailer = None
    if role.name == "retailer":
        retailer = Retailer.query.filter(db.func.lower(Retailer.name) == organisation.lower()).first()
        if retailer is None:
            retailer = Retailer(
                id=next_business_id("retailer", "RTL", 0, width=2),
                name=organisation,
                city=payload.get("city") or "",
                contact=name,
                phone=payload.get("phone") or "",
            )
            db.session.add(retailer)

    user = User(
        id=next_business_id("user", "USR", 3),
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        title=organisation or "Team member",
        initials=initials_for(name),
        retailer=retailer,
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    log_event(
        current_app.logger,
        "auth.register.succeeded",
        user_id=user.id,
        role=role.name,
    )

    return jsonify(_session_payload(user)), 201


@auth_bp.get("/profile")
@jwt_required()
def profile():
    user = load_current_user()
    return jsonify({"user": user_to_dict(user)})


@auth_bp.patch("/profile")
@jwt_required()
def update_profile():
    user = load_current_user()
    payload = request.get_json(silent=True) or {}

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if len(name) < 3:
            raise ApiError(
                "Enter at least 3 characters for your name.",
                422,
                {"name": "Enter at least 3 characters."},
            )
        user.name = name
        user.initials = initials_for(name)
    if "title" in payload:
        user.title = str(payload.get("title") or "").strip()[:120]

    db.session.commit()
    log_event(
        current_app.logger,
        "auth.profile.updated",
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify({"user": user_to_dict(user)})


@auth_bp.post("/password")
@jwt_required()
def change_password():
    user = load_current_user()
    payload = request.get_json(silent=True) or {}
    current_password = payload.get("currentPassword") or payload.get("current") or ""
    new_password = payload.get("newPassword") or payload.get("next") or ""

    errors = {}
    if not current_password:
        errors["current"] = "Enter your current password."
    if not new_password:
        errors["next"] = "Enter a new password."
    elif len(new_password) < 8:
        errors["next"] = "Use at least 8 characters."
    if errors:
        raise ApiError("Please correct the highlighted fields.", 422, errors)
    if not check_password_hash(user.password_hash, current_password):
        raise ApiError(
            "Your current password is incorrect.",
            422,
            {"current": "Incorrect password."},
        )
    if current_password == new_password:
        raise ApiError(
            "Choose a password different from the current one.",
            422,
            {"next": "Enter a different password."},
        )

    user.password_hash = generate_password_hash(new_password)
    db.session.commit()
    log_event(
        current_app.logger,
        "auth.password.changed",
        level=logging.INFO,
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify({"ok": True})


@auth_bp.post("/logout")
@jwt_required()
def logout():
    jti = get_jwt().get("jti")
    if jti and RevokedToken.query.filter_by(jti=jti).first() is None:
        db.session.add(RevokedToken(jti=jti))
        db.session.commit()
    user = load_current_user()
    log_event(
        current_app.logger,
        "auth.logout",
        user_id=user.id,
        role=user.role.name,
    )
    return jsonify({"ok": True})
