from __future__ import annotations

import time
import httpx
from app.config import settings
from app.metrics import INFEROPS_CALLS, TOOL_FAILURES, MODEL_LATENCY, MODEL_COST, MODEL_TOKENS


class InferOpsClient:
    """Adapter for calling a live InferOps AI gateway and tracking model economics."""

    def __init__(self) -> None:
        self.base_url = settings.inferops_ai_url.rstrip("/") if settings.inferops_ai_url else None
        self.timeout = settings.inferops_timeout_seconds

    def enabled(self) -> bool:
        return bool(self.base_url)

    def synthesize_rca(self, prompt: str) -> str | None:
        result = self.synthesize_rca_with_metadata(prompt)
        return result["text"] if result else None

    def synthesize_rca_with_metadata(self, prompt: str) -> dict | None:
        if not self.base_url:
            return None

        headers = {"Content-Type": "application/json"}
        if settings.inferops_api_key:
            headers["Authorization"] = f"Bearer {settings.inferops_api_key}"

        candidate_paths = ["/v1/chat/completions", "/v1/generate", "/v1/rag/query", "/api/generate"]
        payloads = [
            {"model": settings.openai_model, "messages": [{"role": "user", "content": prompt}]},
            {"prompt": prompt, "model": settings.openai_model},
            {"query": prompt},
            {"prompt": prompt},
        ]

        for path, payload in zip(candidate_paths, payloads):
            started = time.perf_counter()
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(f"{self.base_url}{path}", headers=headers, json=payload)
                    latency_ms = (time.perf_counter() - started) * 1000
                    if response.status_code >= 400:
                        continue
                    data = response.json()
                    text = self._extract_text(data)
                    if text:
                        model = self._extract_model(data)
                        usage = self._extract_usage(data, prompt, text)
                        cost = self._extract_cost(data, usage)
                        INFEROPS_CALLS.labels(status="success").inc()
                        MODEL_LATENCY.labels(provider="inferops", model=model).observe(latency_ms / 1000)
                        MODEL_COST.labels(provider="inferops", model=model).inc(cost)
                        MODEL_TOKENS.labels(provider="inferops", model=model, token_type="prompt").inc(usage["prompt_tokens"])
                        MODEL_TOKENS.labels(provider="inferops", model=model, token_type="completion").inc(usage["completion_tokens"])
                        return {
                            "text": text,
                            "provider": "inferops",
                            "model": model,
                            "latency_ms": latency_ms,
                            "prompt_tokens": usage["prompt_tokens"],
                            "completion_tokens": usage["completion_tokens"],
                            "total_tokens": usage["total_tokens"],
                            "cost_usd": cost,
                            "status": "success",
                            "path": path,
                        }
            except Exception:
                continue

        INFEROPS_CALLS.labels(status="failed").inc()
        TOOL_FAILURES.labels(tool="inferops_ai_gateway").inc()
        return None

    @staticmethod
    def _extract_text(data: dict) -> str | None:
        if isinstance(data.get("answer"), str): return data["answer"]
        if isinstance(data.get("response"), str): return data["response"]
        if isinstance(data.get("text"), str): return data["text"]
        if isinstance(data.get("output_text"), str): return data["output_text"]
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
            if isinstance(message.get("content"), str): return message["content"]
        return None

    @staticmethod
    def _extract_model(data: dict) -> str:
        return str(data.get("model") or data.get("selected_model") or data.get("model_name") or settings.openai_model)

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        return max(1, int(len(text.split()) * 1.35))

    def _extract_usage(self, data: dict, prompt: str, completion: str) -> dict:
        usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
        prompt_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or self._estimate_tokens(prompt))
        completion_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or self._estimate_tokens(completion))
        total_tokens = int(usage.get("total_tokens") or prompt_tokens + completion_tokens)
        return {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens, "total_tokens": total_tokens}

    @staticmethod
    def _extract_cost(data: dict, usage: dict) -> float:
        for key in ["cost_usd", "total_cost_usd", "estimated_cost_usd"]:
            if isinstance(data.get(key), (int, float)):
                return float(data[key])
        return round((usage["prompt_tokens"] / 1000 * settings.default_prompt_cost_per_1k) + (usage["completion_tokens"] / 1000 * settings.default_completion_cost_per_1k), 6)
