from __future__ import annotations

import time
import httpx
from app.config import settings
from app.metrics import LOKI_QUERIES, TOOL_FAILURES
from app.services import tool_faults


class LokiClient:
    """Minimal Loki adapter for push + query_range.

    The platform still works if Loki is down; evidence collectors fall back to
    direct service logs. When Loki is running, /simulate-failure pushes log lines
    and LogAnalysisAgent queries them with LogQL.
    """

    def __init__(self) -> None:
        self.base_url = settings.loki_url.rstrip("/")

    def push_logs(self, service_name: str, logs: list[str]) -> dict:
        now_ns = int(time.time() * 1_000_000_000)
        values = [[str(now_ns + i), line] for i, line in enumerate(logs)]
        payload = {"streams": [{"stream": {"job": "services", "service": service_name}, "values": values}]}
        try:
            with httpx.Client(timeout=5) as client:
                response = client.post(f"{self.base_url}/loki/api/v1/push", json=payload)
                response.raise_for_status()
            return {"status": "pushed", "lines": len(logs)}
        except Exception as exc:
            TOOL_FAILURES.labels(tool="loki_push").inc()
            return {"status": "failed", "error": str(exc), "lines": 0}

    def search_logs(self, service_name: str, minutes: int = 60, limit: int = 50) -> list[str]:
        if tool_faults.is_active("loki"):
            tool_faults.record_fallback("loki")
            LOKI_QUERIES.labels(status="failed").inc()
            return []
        end_ns = int(time.time() * 1_000_000_000)
        start_ns = end_ns - minutes * 60 * 1_000_000_000
        params = {
            "query": f'{{service="{service_name}"}}',
            "start": str(start_ns),
            "end": str(end_ns),
            "limit": str(limit),
            "direction": "BACKWARD",
        }
        try:
            with httpx.Client(timeout=6) as client:
                response = client.get(f"{self.base_url}/loki/api/v1/query_range", params=params)
                response.raise_for_status()
                data = response.json()
            lines: list[str] = []
            for stream in data.get("data", {}).get("result", []):
                for _, line in stream.get("values", []):
                    lines.append(line)
            LOKI_QUERIES.labels(status="success").inc()
            return list(reversed(lines))
        except Exception:
            LOKI_QUERIES.labels(status="failed").inc()
            TOOL_FAILURES.labels(tool="loki_query").inc()
            return []
