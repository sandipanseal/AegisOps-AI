from __future__ import annotations

import httpx
from app.config import service_registry_map
from app.metrics import TOOL_FAILURES
from app.services import tool_faults


class ServiceClient:
    """HTTP client for the monitored services the evidence agents read from."""

    def __init__(self) -> None:
        self.urls = service_registry_map()

    def get(self, service_name: str, path: str) -> dict | None:
        if tool_faults.is_active("service"):
            tool_faults.record_fallback("service")
            return None
        base = self.urls.get(service_name)
        if not base:
            return None
        try:
            response = httpx.get(f"{base}{path}", timeout=3.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            TOOL_FAILURES.labels(tool=f"service:{service_name}{path}").inc()
            return None

    def post(self, service_name: str, path: str, payload: dict | None = None) -> dict | None:
        if tool_faults.is_active("service"):
            tool_faults.record_fallback("service")
            return None
        base = self.urls.get(service_name)
        if not base:
            return None
        try:
            response = httpx.post(f"{base}{path}", json=payload or {}, timeout=3.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            TOOL_FAILURES.labels(tool=f"service:{service_name}{path}").inc()
            return None
