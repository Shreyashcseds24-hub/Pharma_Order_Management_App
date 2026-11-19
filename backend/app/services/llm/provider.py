"""Provider-neutral LLM interface and HTTP transport.

Providers are deliberately small: they translate the canonical chat-completions
message format to/from one vendor API and normalise failures into the typed
errors in :mod:`app.services.llm.errors`.

Only the Python standard library is used so the backend does not gain a new
runtime dependency. API keys are held in memory for the duration of a request
and are never logged or returned to the browser.
"""

from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from .errors import (
    LLMAuthError,
    LLMConfigurationError,
    LLMConnectionError,
    LLMError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
)


@dataclass
class ToolCall:
    """A tool invocation requested by the model."""

    name: str
    arguments: dict = field(default_factory=dict)
    id: str = ""


@dataclass
class LLMResponse:
    """Normalised provider response."""

    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str | None = None
    usage: dict | None = None


@dataclass
class StreamChunk:
    """One incremental stream event.

    ``delta`` carries assistant text; the final chunk carries the fully
    accumulated ``response`` so callers can persist and report it once.
    """

    delta: str = ""
    response: LLMResponse | None = None


class LLMProvider:
    """Base class for chat-completions providers."""

    name = "base"

    def __init__(
        self,
        *,
        model: str,
        api_key: str = "",
        base_url: str = "",
        timeout: int = 30,
        max_tokens: int = 800,
        num_ctx: int = 8192,
        stream_max_chunks: int = 4000,
    ):
        if not model:
            raise LLMConfigurationError("LLM_MODEL must be configured.")
        if not base_url:
            raise LLMConfigurationError("LLM_BASE_URL must be configured.")
        if not isinstance(timeout, int) or timeout < 1:
            raise LLMConfigurationError("LLM_TIMEOUT must be a positive integer.")
        if not isinstance(max_tokens, int) or max_tokens < 1:
            raise LLMConfigurationError("LLM_MAX_TOKENS must be a positive integer.")

        self.model = model
        self.api_key = api_key or ""
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_tokens = max_tokens
        self.num_ctx = num_ctx
        self.stream_max_chunks = stream_max_chunks

    def complete(self, messages, tools=None) -> LLMResponse:
        raise NotImplementedError

    def stream(self, messages, tools=None):
        """Yield :class:`StreamChunk` events.

        Providers without native streaming inherit this adapter, which emits
        the complete answer as one delta. The assistant treats both paths
        identically, so authentication, tool execution and persistence stay
        unchanged.
        """
        response = self.complete(messages, tools=tools)
        if response.content:
            yield StreamChunk(delta=response.content)
        yield StreamChunk(response=response)

    # ------------------------------------------------------------------
    # Shared HTTP transport
    # ------------------------------------------------------------------
    def _post_json(self, url, payload, headers=None):
        body = json.dumps(payload).encode("utf-8")
        request_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MediFlow-AI/1.0",
        }
        if headers:
            request_headers.update(headers)

        request = urllib.request.Request(
            url, data=body, headers=request_headers, method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            self._raise_for_http(error.code)
        except (socket.timeout, TimeoutError) as error:
            raise LLMTimeoutError("The AI provider timed out.") from error
        except urllib.error.URLError as error:
            if isinstance(error.reason, (socket.timeout, TimeoutError)):
                raise LLMTimeoutError("The AI provider timed out.") from error
            raise LLMConnectionError("The AI provider could not be reached.") from error
        except OSError as error:
            raise LLMConnectionError("The AI provider could not be reached.") from error

        try:
            data = json.loads(raw)
        except ValueError as error:
            raise LLMResponseError(
                "The AI provider returned an unreadable response."
            ) from error
        if not isinstance(data, dict):
            raise LLMResponseError("The AI provider returned an unexpected response.")
        return data

    def _post_stream(self, url, payload, headers=None, accept="application/x-ndjson"):
        """Open a streaming HTTP response.

        The caller owns the returned response and must close it. Errors are
        normalised to the same typed exceptions as non-streaming requests, and
        no response body is ever included in an exception message.
        """
        body = json.dumps(payload).encode("utf-8")
        request_headers = {
            "Content-Type": "application/json",
            "Accept": accept,
            "User-Agent": "MediFlow-AI/1.0",
        }
        if headers:
            request_headers.update(headers)

        request = urllib.request.Request(
            url, data=body, headers=request_headers, method="POST"
        )
        try:
            return urllib.request.urlopen(request, timeout=self.timeout)
        except urllib.error.HTTPError as error:
            self._raise_for_http(error.code)
        except (socket.timeout, TimeoutError) as error:
            raise LLMTimeoutError("The AI provider timed out.") from error
        except urllib.error.URLError as error:
            if isinstance(error.reason, (socket.timeout, TimeoutError)):
                raise LLMTimeoutError("The AI provider timed out.") from error
            raise LLMConnectionError("The AI provider could not be reached.") from error
        except OSError as error:
            raise LLMConnectionError("The AI provider could not be reached.") from error

    def _raise_for_http(self, status):
        if status in (401, 403):
            raise LLMAuthError("The AI provider rejected the configured credentials.")
        if status == 429:
            raise LLMRateLimitError("The AI provider is rate limiting requests.")
        if status in (400, 404, 405, 422):
            raise LLMResponseError(
                "The AI provider rejected the request. Check LLM_MODEL and tool support."
            )
        if status >= 500:
            raise LLMConnectionError("The AI provider is currently unavailable.")
        raise LLMResponseError("The AI provider returned an unexpected status.")

    # ------------------------------------------------------------------
    # Response helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_arguments(value):
        if value in (None, ""):
            return {}
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError as error:
                raise LLMResponseError(
                    "The model returned malformed tool arguments."
                ) from error
        if not isinstance(value, dict):
            raise LLMResponseError("The model returned malformed tool arguments.")
        return value

    @staticmethod
    def _coerce_content(value):
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        return str(value)


def provider_status(config):
    """Return non-sensitive provider metadata for the frontend/status endpoint."""
    provider = str(config.get("LLM_PROVIDER") or "openai").strip().lower()
    model = str(config.get("LLM_MODEL") or "").strip()
    base_url = str(config.get("LLM_BASE_URL") or "").strip()
    api_key = str(config.get("LLM_API_KEY") or "").strip()

    supported = provider in ("openai", "openai-compatible", "ollama")
    configured = bool(model and base_url) and supported
    if provider in ("openai", "openai-compatible") and not api_key:
        configured = False

    return {
        "enabled": configured,
        "provider": provider,
        "model": model,
        "streaming": bool(config.get("AI_ENABLE_STREAMING", True)),
    }


__all__ = [
    "LLMError",
    "LLMProvider",
    "LLMResponse",
    "StreamChunk",
    "ToolCall",
    "provider_status",
]
