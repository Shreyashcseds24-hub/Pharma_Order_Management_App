"""Local Ollama chat provider.

Ollama's chat API is close to OpenAI's but uses ``/api/chat``, ``options`` for
sampling limits and a slightly different tool-call shape. This module keeps
those differences isolated from the rest of the application.
"""

from __future__ import annotations

import json

from .errors import LLMResponseError
from .provider import LLMProvider, LLMResponse, ToolCall

DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self,
        *,
        model: str,
        api_key: str = "",
        base_url: str = DEFAULT_OLLAMA_BASE_URL,
        timeout: int = 60,
        max_tokens: int = 800,
    ):
        super().__init__(
            model=model,
            api_key=api_key,
            base_url=base_url or DEFAULT_OLLAMA_BASE_URL,
            timeout=timeout,
            max_tokens=max_tokens,
        )

    def _convert_messages(self, messages):
        converted = []
        for message in messages or []:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = self._coerce_content(message.get("content"))

            if role == "tool":
                converted.append(
                    {
                        "role": "tool",
                        "content": content,
                        "tool_name": message.get("tool_name")
                        or message.get("name")
                        or "",
                    }
                )
                continue

            if role == "assistant" and message.get("tool_calls"):
                calls = []
                for call in message["tool_calls"]:
                    function = call.get("function") or {}
                    if not function.get("name"):
                        continue
                    arguments = function.get("arguments") or {}
                    if isinstance(arguments, str):
                        try:
                            arguments = json.loads(arguments) if arguments.strip() else {}
                        except ValueError:
                            arguments = {}
                    calls.append(
                        {
                            "function": {
                                "name": function["name"],
                                "arguments": arguments,
                            }
                        }
                    )
                payload = {"role": "assistant", "content": content}
                if calls:
                    payload["tool_calls"] = calls
                converted.append(payload)
                continue

            converted.append({"role": role, "content": content})
        return converted

    def complete(self, messages, tools=None):
        payload = {
            "model": self.model,
            "messages": self._convert_messages(messages),
            "stream": False,
            "options": {
                "num_predict": self.max_tokens,
                "temperature": 0.2,
            },
        }
        if tools:
            payload["tools"] = tools

        data = self._post_json(f"{self.base_url}/api/chat", payload)

        if data.get("error"):
            raise LLMResponseError("The Ollama provider returned an error.")

        message = data.get("message") or {}
        if not isinstance(message, dict):
            raise LLMResponseError("The Ollama provider returned an unexpected response.")

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
            content=self._coerce_content(message.get("content")),
            tool_calls=tool_calls,
            finish_reason=data.get("done_reason"),
        )
