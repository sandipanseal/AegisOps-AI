from __future__ import annotations

import httpx
from app.config import demo_service_url_map
from app.metrics import TOOL_FAILURES


class DemoServiceClient:
    def __init__(self) -> None:
        self.urls = demo_service_url_map()

    def get(self, service_name: str, path: str) -> dict | None:
        base = self.urls.get(service_name)
        if not base:
            return None
        try:
            response = httpx.get(f"{base}{path}", timeout=3.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            TOOL_FAILURES.labels(tool=f"demo_service:{service_name}{path}").inc()
            return None

    def post(self, service_name: str, path: str, payload: dict | None = None) -> dict | None:
        base = self.urls.get(service_name)
        if not base:
            return None
        try:
            response = httpx.post(f"{base}{path}", json=payload or {}, timeout=3.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            TOOL_FAILURES.labels(tool=f"demo_service:{service_name}{path}").inc()
            return None
