"""Typed LLM errors.

The blueprint maps these to safe HTTP responses. Provider response bodies,
prompts and credentials are never included in the messages returned to clients.
"""


class LLMError(Exception):
    code = "llm_error"

    def __init__(self, message=None):
        super().__init__(message or "The AI provider is unavailable.")
        self.message = message or "The AI provider is unavailable."


class LLMConfigurationError(LLMError):
    code = "configuration"


class LLMAuthError(LLMError):
    code = "authentication"


class LLMRateLimitError(LLMError):
    code = "rate_limit"


class LLMTimeoutError(LLMError):
    code = "timeout"


class LLMConnectionError(LLMError):
    code = "connection"


class LLMResponseError(LLMError):
    code = "invalid_response"
