import httpx
from app.config import settings
from app.metrics import TOOL_FAILURES


class PrometheusTool:
    async def query(self, query: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(
                    f"{settings.prometheus_url}/api/v1/query",
                    params={"query": query},
                )
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            TOOL_FAILURES.labels(tool="prometheus").inc()
            return {"status": "unavailable", "error": str(exc), "query": query}
