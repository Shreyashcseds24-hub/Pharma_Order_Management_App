"""OpenAI-compatible chat-completions provider."""

from __future__ import annotations

import json

from .errors import LLMConfigurationError, LLMResponseError
from .provider import LLMProvider, LLMResponse, StreamChunk, ToolCall

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(
        self,
        *,
        model: str,
        api_key: str = "",
        base_url: str = DEFAULT_OPENAI_BASE_URL,
        timeout: int = 30,
        max_tokens: int = 800,
        num_ctx: int = 8192,
        stream_max_chunks: int = 4000,
    ):
        if not api_key:
            raise LLMConfigurationError(
                "LLM_API_KEY is required for the OpenAI-compatible provider."
            )
        super().__init__(
            model=model,
            api_key=api_key,
            base_url=base_url or DEFAULT_OPENAI_BASE_URL,
            timeout=timeout,
            max_tokens=max_tokens,
            num_ctx=num_ctx,
            stream_max_chunks=stream_max_chunks,
        )

    def complete(self, messages, tools=None):
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": 0.2,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        data = self._post_json(
            f"{self.base_url}/chat/completions",
            payload,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise LLMResponseError("The AI provider returned no completion choices.")

        choice = choices[0] if isinstance(choices[0], dict) else {}
        message = choice.get("message") or {}
        content = self._coerce_content(message.get("content"))

        tool_calls = []
        for index, raw in enumerate(message.get("tool_calls") or []):
            if not isinstance(raw, dict):
                continue
            function = raw.get("function") or {}
            name = function.get("name")
            if not name:
                continue
            tool_calls.append(
                ToolCall(
                    id=str(raw.get("id") or f"call_{index}"),
                    name=str(name),
                    arguments=self._parse_arguments(function.get("arguments")),
                )
            )

        return LLMResponse(
            content=content,
            tool_calls=tool_calls,
            finish_reason=choice.get("finish_reason"),
            usage=data.get("usage") if isinstance(data.get("usage"), dict) else None,
        )

    def stream(self, messages, tools=None):
        """Stream Server-Sent Events from a chat-completions compatible API."""
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": 0.2,
            "stream": True,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        content_parts = []
        calls = {}
        finish_reason = None
        usage = None
        done = False
        with self._post_stream(
            f"{self.base_url}/chat/completions",
            payload,
            headers={"Authorization": f"Bearer {self.api_key}"},
            accept="text/event-stream",
        ) as response:
            for chunk_number, line in enumerate(response):
                if chunk_number >= self.stream_max_chunks:
                    raise LLMResponseError(
                        "The AI provider returned too many stream chunks."
                    )
                text = (
                    line.decode("utf-8", errors="replace")
                    if isinstance(line, bytes)
                    else str(line)
                ).strip()
                if not text.startswith("data:"):
                    continue
                data_text = text[5:].strip()
                if data_text == "[DONE]":
                    done = True
                    break
                try:
                    data = json.loads(data_text)
                except ValueError as error:
                    raise LLMResponseError(
                        "The AI provider returned an unreadable stream."
                    ) from error
                if not isinstance(data, dict):
                    continue
                if data.get("error"):
                    raise LLMResponseError("The AI provider returned an error.")
                if isinstance(data.get("usage"), dict):
                    usage = data["usage"]
                choices = data.get("choices")
                if not isinstance(choices, list) or not choices:
                    continue
                choice = choices[0] if isinstance(choices[0], dict) else {}
                delta = choice.get("delta") or {}
                if choice.get("finish_reason"):
                    finish_reason = choice["finish_reason"]
                content = delta.get("content")
                if content:
                    content_parts.append(str(content))
                    yield StreamChunk(delta=str(content))
                for index, raw in enumerate(delta.get("tool_calls") or []):
                    if not isinstance(raw, dict):
                        continue
                    call_index = int(raw.get("index") or index)
                    entry = calls.setdefault(
                        call_index, {"id": "", "name": "", "arguments": ""}
                    )
                    if raw.get("id"):
                        entry["id"] = str(raw["id"])
                    function = raw.get("function") or {}
                    if function.get("name"):
                        entry["name"] += str(function["name"])
                    if function.get("arguments"):
                        entry["arguments"] += str(function["arguments"])
        if not done and not finish_reason:
            raise LLMResponseError("The AI provider ended the stream before completion.")

        tool_calls = [
            ToolCall(
                id=entry["id"] or f"call_{index}",
                name=entry["name"],
                arguments=self._parse_arguments(entry["arguments"]),
            )
            for index, entry in sorted(calls.items())
            if entry["name"]
        ]
        yield StreamChunk(
            response=LLMResponse(
                content="".join(content_parts),
                tool_calls=tool_calls,
                finish_reason=finish_reason,
                usage=usage,
            )
        )
