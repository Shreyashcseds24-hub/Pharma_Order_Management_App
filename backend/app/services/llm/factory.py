"""Provider factory.

The active provider is selected from configuration. Tests can inject a fake
provider through ``app.extensions['llm_provider']`` without changing production
code paths.
"""

from __future__ import annotations

from flask import current_app, has_app_context

from .errors import LLMConfigurationError
from .ollama_provider import DEFAULT_OLLAMA_BASE_URL, OllamaProvider
from .openai_provider import DEFAULT_OPENAI_BASE_URL, OpenAIProvider

SUPPORTED_PROVIDERS = ("openai", "openai-compatible", "ollama")


def create_provider(config=None):
    """Build the configured provider, or return an injected test provider."""
    app = current_app._get_current_object() if has_app_context() else None
    if app is not None:
        override = app.extensions.get("llm_provider")
        if override is not None:
            return override

    settings = config
    if settings is None:
        if app is None:
            raise LLMConfigurationError(
                "LLM configuration is only available inside an application context."
            )
        settings = app.config

    provider = str(settings.get("LLM_PROVIDER") or "openai").strip().lower()
    model = str(settings.get("LLM_MODEL") or "").strip()
    api_key = str(settings.get("LLM_API_KEY") or "").strip()
    base_url = str(settings.get("LLM_BASE_URL") or "").strip()
    timeout = settings.get("LLM_TIMEOUT", 30)
    max_tokens = settings.get("LLM_MAX_TOKENS", 800)

    if provider == "ollama":
        return OllamaProvider(
            model=model,
            api_key=api_key,
            base_url=base_url or DEFAULT_OLLAMA_BASE_URL,
            timeout=timeout,
            max_tokens=max_tokens,
        )

    if provider in ("openai", "openai-compatible"):
        return OpenAIProvider(
            model=model,
            api_key=api_key,
            base_url=base_url or DEFAULT_OPENAI_BASE_URL,
            timeout=timeout,
            max_tokens=max_tokens,
        )

    raise LLMConfigurationError(
        f"Unsupported LLM_PROVIDER '{provider}'. "
        f"Choose one of: {', '.join(SUPPORTED_PROVIDERS)}."
    )
