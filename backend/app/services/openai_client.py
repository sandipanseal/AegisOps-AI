from __future__ import annotations

import time
import httpx
from app.config import settings
from app.metrics import OPENAI_CALLS, TOOL_FAILURES, MODEL_LATENCY, MODEL_COST, MODEL_TOKENS


class OpenAIClient:
    """Direct OpenAI Chat Completions adapter.

    Acts as the real-model path when no InferOps AI gateway is configured (or the
    configured gateway is unreachable / not a real LLM endpoint) but OPENAI_API_KEY
    is set. It tracks the same model economics (latency, tokens, cost) as the
    InferOps path so the Integrations "Model usage" view and the Grafana model
    panels populate from live calls instead of staying empty.
    """

    BASE_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.timeout = settings.inferops_timeout_seconds

    def enabled(self) -> bool:
        return bool(self.api_key)

    def synthesize_rca_with_metadata(self, prompt: str) -> dict | None:
        if not self.api_key:
            return None

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": [{"role": "user", "content": prompt}]}
        started = time.perf_counter()
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(self.BASE_URL, headers=headers, json=payload)
                latency_ms = (time.perf_counter() - started) * 1000
                response.raise_for_status()
                data = response.json()
        except Exception:
            OPENAI_CALLS.labels(status="failed").inc()
            TOOL_FAILURES.labels(tool="openai_chat_completions").inc()
            return None

        choices = data.get("choices") or []
        text = choices[0].get("message", {}).get("content") if choices and isinstance(choices[0], dict) else None
        if not text:
            OPENAI_CALLS.labels(status="failed").inc()
            return None

        model = str(data.get("model") or self.model)
        usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
        prompt_tokens = int(usage.get("prompt_tokens") or 0)
        completion_tokens = int(usage.get("completion_tokens") or 0)
        total_tokens = int(usage.get("total_tokens") or prompt_tokens + completion_tokens)
        cost = round(
            (prompt_tokens / 1000 * settings.default_prompt_cost_per_1k)
            + (completion_tokens / 1000 * settings.default_completion_cost_per_1k),
            6,
        )

        OPENAI_CALLS.labels(status="success").inc()
        MODEL_LATENCY.labels(provider="openai", model=model).observe(latency_ms / 1000)
        MODEL_COST.labels(provider="openai", model=model).inc(cost)
        MODEL_TOKENS.labels(provider="openai", model=model, token_type="prompt").inc(prompt_tokens)
        MODEL_TOKENS.labels(provider="openai", model=model, token_type="completion").inc(completion_tokens)

        return {
            "text": text,
            "provider": "openai",
            "model": model,
            "latency_ms": latency_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost,
            "status": "success",
            "path": "/v1/chat/completions",
        }
