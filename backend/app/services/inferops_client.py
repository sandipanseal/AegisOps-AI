from __future__ import annotations

import httpx
from app.config import settings
from app.metrics import INFEROPS_CALLS, TOOL_FAILURES


class InferOpsClient:
    """Small adapter for calling a live InferOps AI gateway if configured.

    This keeps AegisOps AI decoupled from model providers. If INFEROPS_AI_URL is
    unset or the gateway call fails, AegisOps falls back to deterministic RCA.
    """

    def __init__(self) -> None:
        self.base_url = settings.inferops_ai_url.rstrip("/") if settings.inferops_ai_url else None
        self.timeout = settings.inferops_timeout_seconds

    def enabled(self) -> bool:
        return bool(self.base_url)

    def synthesize_rca(self, prompt: str) -> str | None:
        if not self.base_url:
            return None

        headers = {"Content-Type": "application/json"}
        if settings.inferops_api_key:
            headers["Authorization"] = f"Bearer {settings.inferops_api_key}"

        candidate_paths = [
            "/v1/chat/completions",
            "/v1/generate",
            "/v1/rag/query",
            "/api/generate",
        ]
        payloads = [
            {"model": settings.openai_model, "messages": [{"role": "user", "content": prompt}]},
            {"prompt": prompt, "model": settings.openai_model},
            {"query": prompt},
            {"prompt": prompt},
        ]

        for path, payload in zip(candidate_paths, payloads):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(f"{self.base_url}{path}", headers=headers, json=payload)
                    if response.status_code >= 400:
                        continue
                    data = response.json()
                    text = self._extract_text(data)
                    if text:
                        INFEROPS_CALLS.labels(status="success").inc()
                        return text
            except Exception:
                continue

        INFEROPS_CALLS.labels(status="failed").inc()
        TOOL_FAILURES.labels(tool="inferops_ai_gateway").inc()
        return None

    @staticmethod
    def _extract_text(data: dict) -> str | None:
        if isinstance(data.get("answer"), str):
            return data["answer"]
        if isinstance(data.get("response"), str):
            return data["response"]
        if isinstance(data.get("text"), str):
            return data["text"]
        if isinstance(data.get("output_text"), str):
            return data["output_text"]
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
            if isinstance(message.get("content"), str):
                return message["content"]
        return None
