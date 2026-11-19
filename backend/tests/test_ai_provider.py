"""LLM provider tests. No real provider is contacted."""

import json
import socket

import pytest

from app.services.llm import (
    LLMAuthError,
    LLMConfigurationError,
    LLMConnectionError,
    LLMRateLimitError,
    LLMResponseError,
    LLMTimeoutError,
    provider_status,
)
from app.services.llm.factory import create_provider
from app.services.llm.ollama_provider import OllamaProvider
from app.services.llm.openai_provider import OpenAIProvider


def test_openai_provider_parses_content_and_tool_calls():
    provider = OpenAIProvider(
        model="test-model",
        api_key="test-key",
        base_url="https://provider.example/v1",
    )
    captured = {}

    def fake_post(url, payload, headers=None):
        captured["url"] = url
        captured["payload"] = payload
        captured["headers"] = headers
        return {
            "choices": [
                {
                    "message": {
                        "content": "Checking inventory.",
                        "tool_calls": [
                            {
                                "id": "call-1",
                                "function": {
                                    "name": "get_inventory_summary",
                                    "arguments": "{}",
                                },
                            }
                        ],
                    },
                    "finish_reason": "tool_calls",
                }
            ],
            "usage": {"total_tokens": 12},
        }

    provider._post_json = fake_post
    response = provider.complete(
        [{"role": "user", "content": "How is inventory?"}],
        tools=[{"type": "function", "function": {"name": "get_inventory_summary"}}],
    )

    assert response.content == "Checking inventory."
    assert response.tool_calls[0].name == "get_inventory_summary"
    assert response.tool_calls[0].arguments == {}
    assert captured["url"] == "https://provider.example/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["payload"]["tools"]


def test_openai_provider_rejects_malformed_tool_arguments():
    provider = OpenAIProvider(model="test-model", api_key="test-key")
    provider._post_json = lambda *args, **kwargs: {
        "choices": [
            {
                "message": {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "call-1",
                            "function": {
                                "name": "get_inventory_summary",
                                "arguments": "{not-json",
                            },
                        }
                    ],
                }
            }
        ]
    }

    with pytest.raises(LLMResponseError):
        provider.complete([{"role": "user", "content": "hi"}])


def test_ollama_provider_parses_tool_calls_and_converts_messages():
    provider = OllamaProvider(model="llama-test", base_url="http://127.0.0.1:11434")
    captured = {}

    def fake_post(url, payload, headers=None):
        captured["url"] = url
        captured["payload"] = payload
        return {
            "message": {
                "content": "",
                "tool_calls": [
                    {
                        "function": {
                            "name": "get_pending_orders",
                            "arguments": {"limit": 5},
                        }
                    }
                ],
            },
            "done_reason": "stop",
        }

    provider._post_json = fake_post
    response = provider.complete(
        [
            {"role": "user", "content": "pending?"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call-1",
                        "function": {
                            "name": "get_pending_orders",
                            "arguments": "{\"limit\": 5}",
                        },
                    }
                ],
            },
            {"role": "tool", "tool_call_id": "call-1", "content": "{}"},
        ],
        tools=[{"type": "function", "function": {"name": "get_pending_orders"}}],
    )

    assert response.tool_calls[0].name == "get_pending_orders"
    assert response.tool_calls[0].arguments == {"limit": 5}
    assert captured["url"] == "http://127.0.0.1:11434/api/chat"
    assert captured["payload"]["stream"] is False
    assert captured["payload"]["messages"][1]["tool_calls"][0]["function"]["arguments"] == {
        "limit": 5
    }
    assert captured["payload"]["messages"][2]["tool_name"] == ""


def test_provider_maps_http_errors_without_leaking_bodies():
    provider = OpenAIProvider(model="test-model", api_key="test-key")

    with pytest.raises(LLMAuthError):
        provider._raise_for_http(401)
    with pytest.raises(LLMRateLimitError):
        provider._raise_for_http(429)
    with pytest.raises(LLMResponseError):
        provider._raise_for_http(400)
    with pytest.raises(LLMConnectionError):
        provider._raise_for_http(503)


def test_provider_maps_timeout_and_connection_failures(monkeypatch):
    provider = OpenAIProvider(model="test-model", api_key="test-key")

    def timeout(*args, **kwargs):
        raise socket.timeout()

    monkeypatch.setattr("urllib.request.urlopen", timeout)
    with pytest.raises(LLMTimeoutError):
        provider._post_json("https://provider.example/v1/chat/completions", {})

    def connection_error(*args, **kwargs):
        raise OSError("no route")

    monkeypatch.setattr("urllib.request.urlopen", connection_error)
    with pytest.raises(LLMConnectionError):
        provider._post_json("https://provider.example/v1/chat/completions", {})


def test_factory_builds_configured_providers():
    ollama = create_provider(
        {
            "LLM_PROVIDER": "ollama",
            "LLM_MODEL": "llama3.1:8b",
            "LLM_BASE_URL": "http://127.0.0.1:11434",
            "LLM_API_KEY": "",
            "LLM_TIMEOUT": 30,
            "LLM_MAX_TOKENS": 800,
        }
    )
    assert isinstance(ollama, OllamaProvider)

    openai = create_provider(
        {
            "LLM_PROVIDER": "openai-compatible",
            "LLM_MODEL": "gpt-test",
            "LLM_BASE_URL": "https://provider.example/v1",
            "LLM_API_KEY": "test-key",
            "LLM_TIMEOUT": 30,
            "LLM_MAX_TOKENS": 800,
        }
    )
    assert isinstance(openai, OpenAIProvider)


def test_factory_rejects_unknown_provider_and_missing_openai_key():
    with pytest.raises(LLMConfigurationError):
        create_provider(
            {
                "LLM_PROVIDER": "unknown",
                "LLM_MODEL": "model",
                "LLM_BASE_URL": "https://provider.example/v1",
            }
        )

    with pytest.raises(LLMConfigurationError):
        create_provider(
            {
                "LLM_PROVIDER": "openai",
                "LLM_MODEL": "model",
                "LLM_BASE_URL": "https://provider.example/v1",
                "LLM_API_KEY": "",
            }
        )


def test_provider_status_never_exposes_the_api_key():
    status = provider_status(
        {
            "LLM_PROVIDER": "openai",
            "LLM_MODEL": "gpt-test",
            "LLM_BASE_URL": "https://provider.example/v1",
            "LLM_API_KEY": "super-secret-key",
        }
    )
    assert status == {
        "enabled": True,
        "provider": "openai",
        "model": "gpt-test",
        "streaming": True,
    }
    assert "super-secret-key" not in repr(status)

    disabled = provider_status(
        {
            "LLM_PROVIDER": "openai",
            "LLM_MODEL": "gpt-test",
            "LLM_BASE_URL": "https://provider.example/v1",
            "LLM_API_KEY": "super-secret-key",
            "AI_ENABLE_STREAMING": False,
        }
    )
    assert disabled["streaming"] is False


class FakeStream:
    """Minimal context-managed iterable that mimics a streaming HTTP response."""

    def __init__(self, lines):
        self.lines = lines

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def __iter__(self):
        return iter(self.lines)


def test_ollama_stream_accumulates_text_and_tool_calls():
    provider = OllamaProvider(model="llama-test")
    provider._post_stream = lambda *args, **kwargs: FakeStream(
        [
            json.dumps(
                {
                    "message": {
                        "content": "Checking ",
                        "tool_calls": [
                            {
                                "function": {
                                    "name": "get_inventory_summary",
                                    "arguments": {},
                                }
                            }
                        ],
                    },
                    "done": False,
                }
            ).encode()
            + b"\n",
            json.dumps(
                {"message": {"content": "inventory."}, "done": True, "done_reason": "stop"}
            ).encode()
            + b"\n",
        ]
    )

    chunks = list(
        provider.stream(
            [{"role": "user", "content": "How is inventory?"}],
            tools=[{"type": "function", "function": {"name": "get_inventory_summary"}}],
        )
    )
    assert [chunk.delta for chunk in chunks if chunk.delta] == [
        "Checking ",
        "inventory.",
    ]
    final = chunks[-1].response
    assert final.content == "Checking inventory."
    assert final.tool_calls[0].name == "get_inventory_summary"
    assert final.tool_calls[0].arguments == {}
    assert final.finish_reason == "stop"


def test_openai_stream_accumulates_fragmented_tool_arguments():
    provider = OpenAIProvider(model="test-model", api_key="test-key")

    def sse(payload):
        return ("data: " + json.dumps(payload) + "\n\n").encode()

    provider._post_stream = lambda *args, **kwargs: FakeStream(
        [
            sse({"choices": [{"delta": {"content": "Hello"}}]}),
            sse(
                {
                    "choices": [
                        {
                            "delta": {
                                "tool_calls": [
                                    {
                                        "index": 0,
                                        "id": "call-1",
                                        "function": {
                                            "name": "get_pending_orders",
                                            "arguments": '{"limit":',
                                        },
                                    }
                                ]
                            }
                        }
                    ]
                }
            ),
            sse(
                {
                    "choices": [
                        {
                            "delta": {
                                "tool_calls": [
                                    {
                                        "index": 0,
                                        "function": {"arguments": "5}"},
                                    }
                                ]
                            }
                        }
                    ]
                }
            ),
            sse({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}),
            b"data: [DONE]\n\n",
        ]
    )

    chunks = list(
        provider.stream(
            [{"role": "user", "content": "pending?"}],
            tools=[{"type": "function", "function": {"name": "get_pending_orders"}}],
        )
    )
    assert [chunk.delta for chunk in chunks if chunk.delta] == ["Hello"]
    final = chunks[-1].response
    assert final.content == "Hello"
    assert final.tool_calls[0].id == "call-1"
    assert final.tool_calls[0].name == "get_pending_orders"
    assert final.tool_calls[0].arguments == {"limit": 5}
