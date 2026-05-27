from app.schemas import Evidence
from app.tools.prometheus_tool import PrometheusTool


class MetricAnalyzer:
    def __init__(self) -> None:
        self.prometheus = PrometheusTool()

    async def analyze(self, service_name: str) -> Evidence:
        latency_query = f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{service="{service_name}"}}[5m]))'
        error_query = f'rate(http_requests_total{{service="{service_name}",status=~"5.."}}[5m])'

        latency = await self.prometheus.query(latency_query)
        errors = await self.prometheus.query(error_query)

        return Evidence(
            source="metrics",
            summary=(
                f"Metrics indicate elevated p95 latency and 5xx rate for {service_name}. "
                "This supports a service or dependency degradation hypothesis."
            ),
            details={
                "latency_query": latency_query,
                "error_query": error_query,
                "latency_result": latency,
                "error_result": errors,
            },
        )
