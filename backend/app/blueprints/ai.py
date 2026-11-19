"""Authenticated AI assistant endpoints.

Security invariants:

* every endpoint requires a valid JWT and the ``reports:view`` permission;
* conversations are always filtered by ``user_id`` (one user cannot read or
  continue another user's conversation);
* the model can only execute the read-only tools in
  :mod:`app.services.ai_tools`;
* provider failures are mapped to safe messages and never leak response bodies,
  prompts or credentials.
"""

from __future__ import annotations

import json
import logging
from datetime import timedelta

from flask import Blueprint, Response, current_app, jsonify, request, stream_with_context
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func

from ..errors import ApiError
from ..extensions import db
from ..logging_config import log_event
from ..models import AIConversation, AIMessage, User, utcnow
from ..permissions import load_current_user, require_permission
from ..services.ai_assistant import run_chat, stream_chat
from ..services.llm import (
    LLMAuthError,
    LLMConfigurationError,
    LLMConnectionError,
    LLMError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
    provider_status,
)
from ..utils import json_datetime, next_business_id

ai_bp = Blueprint("ai", __name__)

DEFAULT_TITLE = "New conversation"
ALLOWED_CHAT_FIELDS = {"message", "conversation_id"}


def _validate_chat_request():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ApiError("A JSON request body is required.", 400)

    unknown = sorted(set(payload) - ALLOWED_CHAT_FIELDS)
    if unknown:
        raise ApiError(
            "The request contains unsupported fields.",
            422,
            {field: "Unsupported field." for field in unknown},
        )

    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        raise ApiError(
            "message is required.", 422, {"message": "Enter a question for the assistant."}
        )
    message = message.strip()

    max_length = int(current_app.config.get("AI_MAX_MESSAGE_LENGTH", 2000))
    if len(message) > max_length:
        raise ApiError(
            f"message must be at most {max_length} characters.",
            422,
            {"message": f"Shorten the question to {max_length} characters or fewer."},
        )

    conversation_id = payload.get("conversation_id")
    if conversation_id in (None, ""):
        conversation_id = None
    elif not isinstance(conversation_id, str):
        raise ApiError(
            "conversation_id must be a string.", 422, {"conversation_id": "Invalid value."}
        )
    else:
        conversation_id = conversation_id.strip()
        if len(conversation_id) > 30:
            raise ApiError(
                "conversation_id is invalid.",
                422,
                {"conversation_id": "Invalid value."},
            )

    return message, conversation_id


def _enforce_rate_limit(user):
    limit = int(current_app.config.get("AI_RATE_LIMIT_REQUESTS", 20))
    window = int(current_app.config.get("AI_RATE_LIMIT_WINDOW_SECONDS", 300))
    if limit <= 0 or window <= 0:
        return

    cutoff = utcnow() - timedelta(seconds=window)
    recent = (
        db.session.query(func.count(AIMessage.id))
        .join(AIConversation, AIMessage.conversation_id == AIConversation.id)
        .filter(
            AIConversation.user_id == user.id,
            AIMessage.role == "user",
            AIMessage.created_at >= cutoff,
        )
        .scalar()
        or 0
    )
    if recent >= limit:
        raise ApiError(
            "Too many AI requests in a short period. Please wait a few minutes and try again.",
            429,
        )


def _owned_conversation(user, conversation_id):
    if conversation_id is None:
        return None
    conversation = AIConversation.query.filter_by(
        id=conversation_id, user_id=user.id
    ).first()
    if conversation is None:
        # Do not reveal whether the conversation exists for another user.
        raise ApiError("Conversation not found.", 404)
    return conversation


def _create_conversation(user, message):
    conversation = AIConversation(
        id=next_business_id("ai_conversation", "AIC", 1000, width=4),
        user_id=user.id,
        title=(message[:80] or DEFAULT_TITLE),
        last_message_at=utcnow(),
    )
    db.session.add(conversation)
    db.session.flush()
    return conversation


def _add_message(conversation, role, content):
    message = AIMessage(
        conversation_id=conversation.id,
        role=role,
        content=content,
    )
    conversation.last_message_at = utcnow()
    db.session.add(message)
    return message


def _safe_provider_error(error):
    """Map provider errors to safe API errors without exposing response bodies."""
    if isinstance(error, LLMConfigurationError):
        return ApiError(
            "The AI assistant is not configured. Ask an administrator to set "
            "LLM_PROVIDER, LLM_MODEL and LLM_API_KEY (or LLM_BASE_URL for Ollama).",
            503,
        )
    if isinstance(error, LLMTimeoutError):
        return ApiError("The AI provider timed out. Please try again.", 504)
    if isinstance(error, LLMRateLimitError):
        return ApiError(
            "The AI provider is rate limiting requests. Please try again shortly.", 429
        )
    if isinstance(error, LLMAuthError):
        return ApiError(
            "The AI provider rejected its configured credentials. Ask an administrator "
            "to check the LLM settings.",
            502,
        )
    if isinstance(error, LLMConnectionError):
        return ApiError(
            "The AI provider is currently unavailable. Please try again later.", 503
        )
    if isinstance(error, LLMResponseError):
        return ApiError(
            "The AI provider returned an invalid response. Please try again.", 502
        )
    if isinstance(error, LLMError):
        return ApiError("The AI assistant is currently unavailable.", 503)
    return ApiError("The AI assistant is currently unavailable.", 503)


@ai_bp.post("/chat")
@require_permission("reports:view")
def chat():
    user = load_current_user()
    message_text, conversation_id = _validate_chat_request()
    _enforce_rate_limit(user)

    conversation = _owned_conversation(user, conversation_id)
    if conversation is None:
        conversation = _create_conversation(user, message_text)

    _add_message(conversation, "user", message_text)
    conversation.last_message_at = utcnow()
    # Persist the user turn before calling the provider so conversation
    # ownership and rate-limit accounting survive a provider failure.
    db.session.commit()

    try:
        result = run_chat(user, message_text, conversation, current_app.config)
    except LLMError as error:
        log_event(
            current_app.logger,
            "ai.provider_error",
            level=logging.WARNING if not isinstance(error, LLMConfigurationError) else logging.ERROR,
            conversation_id=conversation.id,
            error_type=type(error).__name__,
        )
        raise _safe_provider_error(error) from error

    _add_message(conversation, "assistant", result["answer"])
    conversation.last_message_at = utcnow()
    db.session.commit()

    log_event(
        current_app.logger,
        "ai.chat",
        conversation_id=conversation.id,
        user_id=user.id,
        role=user.role.name,
        tool_count=len(result["tool_calls"]),
        tools=[call["name"] for call in result["tool_calls"]],
        limited=result.get("limited", False),
    )

    return jsonify(
        {
            "conversation_id": conversation.id,
            "answer": result["answer"],
            "sources": result["sources"],
            "tool_calls": result["tool_calls"],
            "follow_ups": result["follow_ups"],
            "limited": result.get("limited", False),
        }
    )


@ai_bp.post("/chat/stream")
@require_permission("reports:view")
def chat_stream():
    """Server-Sent Events variant of ``/chat``.

    Authentication, rate limiting, conversation ownership, tool execution and
    persistence use exactly the same helpers as the non-streaming endpoint.
    Only the final assistant text is streamed; tool calls are accumulated by
    the provider and executed before any answer text is released.
    """
    user = load_current_user()
    message_text, conversation_id = _validate_chat_request()
    _enforce_rate_limit(user)

    conversation = _owned_conversation(user, conversation_id)
    if conversation is None:
        conversation = _create_conversation(user, message_text)
    _add_message(conversation, "user", message_text)
    db.session.commit()

    conversation_id = conversation.id
    parts = []
    completed = False

    def generate():
        nonlocal completed
        # The response streams after the request handler returns, so the ORM
        # objects captured above may be detached. Reload them inside the
        # stream's app context before any lazy load, tool call or commit.
        active_user = db.session.get(User, get_jwt_identity())
        active_conversation = AIConversation.query.filter_by(
            id=conversation_id, user_id=active_user.id
        ).first()
        events = stream_chat(
            active_user, message_text, active_conversation, current_app.config
        )
        try:
            for kind, payload in events:
                if kind == "status":
                    yield f"data: {json.dumps({'type': 'status', 'stage': payload})}\n\n"
                elif kind == "delta":
                    parts.append(payload)
                    yield f"data: {json.dumps({'type': 'delta', 'text': payload})}\n\n"
                elif kind == "done":
                    _add_message(active_conversation, "assistant", payload["answer"])
                    active_conversation.last_message_at = utcnow()
                    db.session.commit()
                    completed = True
                    log_event(
                        current_app.logger,
                        "ai.chat.stream",
                        conversation_id=active_conversation.id,
                        user_id=active_user.id,
                        role=active_user.role.name,
                        tool_count=len(payload["tool_calls"]),
                        tools=[call["name"] for call in payload["tool_calls"]],
                        limited=payload.get("limited", False),
                    )
                    yield (
                        "data: "
                        + json.dumps(
                            {
                                "type": "done",
                                "conversation_id": active_conversation.id,
                                "answer": payload["answer"],
                                "sources": payload["sources"],
                                "tool_calls": payload["tool_calls"],
                                "follow_ups": payload["follow_ups"],
                                "limited": payload.get("limited", False),
                            }
                        )
                        + "\n\n"
                    )
        except LLMError as error:
            log_event(
                current_app.logger,
                "ai.provider_error",
                level=logging.WARNING,
                conversation_id=conversation_id,
                error_type=type(error).__name__,
            )
            yield (
                "event: error\ndata: "
                + json.dumps({"message": _safe_provider_error(error).message})
                + "\n\n"
            )
        except Exception:  # noqa: BLE001 - never leak an internal error to the browser
            log_event(
                current_app.logger,
                "ai.stream_error",
                level=logging.ERROR,
                conversation_id=conversation_id,
            )
            yield (
                "event: error\ndata: "
                + json.dumps({"message": "The AI assistant is currently unavailable."})
                + "\n\n"
            )
        finally:
            # A closed browser connection stops the generator. Keep whatever
            # text was already produced so the transcript is not silently lost.
            if not completed and parts:
                try:
                    _add_message(
                        active_conversation,
                        "assistant",
                        "".join(parts) + "\n\n[Response interrupted.]",
                    )
                    active_conversation.last_message_at = utcnow()
                    db.session.commit()
                except Exception:  # noqa: BLE001 - the client is already gone
                    db.session.rollback()


    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers=headers,
    )


@ai_bp.get("/status")
@require_permission("reports:view")
def status():
    return jsonify(provider_status(current_app.config))


@ai_bp.get("/conversations")
@require_permission("reports:view")
def list_conversations():
    user = load_current_user()
    conversations = (
        AIConversation.query.filter_by(user_id=user.id)
        .order_by(AIConversation.last_message_at.desc(), AIConversation.id.desc())
        .limit(20)
        .all()
    )
    return jsonify(
        {
            "conversations": [
                {
                    "conversation_id": conversation.id,
                    "title": conversation.title,
                    "last_message_at": json_datetime(conversation.last_message_at),
                }
                for conversation in conversations
            ]
        }
    )


@ai_bp.get("/conversations/<conversation_id>")
@require_permission("reports:view")
def get_conversation(conversation_id):
    user = load_current_user()
    conversation = _owned_conversation(user, conversation_id)
    if conversation is None:
        raise ApiError("Conversation not found.", 404)
    return jsonify(
        {
            "conversation_id": conversation.id,
            "title": conversation.title,
            "created_at": json_datetime(conversation.created_at),
            "updated_at": json_datetime(conversation.updated_at),
            "messages": [
                {
                    "role": message.role,
                    "content": message.content,
                    "created_at": json_datetime(message.created_at),
                }
                for message in conversation.messages
            ],
        }
    )
