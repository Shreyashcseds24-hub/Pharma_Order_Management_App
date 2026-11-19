"""OpenAI-compatible chat-completions provider."""

from __future__ import annotations

from .errors import LLMConfigurationError, LLMResponseError
from .provider import LLMProvider, LLMResponse, ToolCall

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
