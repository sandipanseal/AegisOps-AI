from app.schemas import Evidence
from app.data.scenarios import SCENARIOS


def _scenario(incident) -> dict:
    return SCENARIOS.get(getattr(incident, "scenario_key", "custom"), SCENARIOS["payment_pool_regression"])


class LogAnalysisAgent:
    name = "LogAnalysisAgent"

    def run(self, incident) -> Evidence:
        data = _scenario(incident)
        logs = data["logs"]
        error_count = sum(1 for line in logs if "ERROR" in line)
        return Evidence(
            source="logs",
            summary=f"Found {error_count} critical log patterns for {incident.service_name}: {logs[0]}",
            details={"sample_logs": logs, "error_count": error_count},
        )


class MetricsAnalysisAgent:
    name = "MetricsAnalysisAgent"

    def run(self, incident) -> Evidence:
        metrics = _scenario(incident)["metrics"]
        return Evidence(
            source="metrics",
            summary=f"p95 latency={metrics['p95_latency_ms']}ms, error rate={metrics['error_rate_pct']}%, memory={metrics['memory_pct']}%.",
            details=metrics,
        )


class KubernetesStateAgent:
    name = "KubernetesStateAgent"

    def run(self, incident) -> Evidence:
        k8s = _scenario(incident)["kubernetes"]
        unhealthy = [pod for pod in k8s.get("pods", []) if pod.get("status") != "Running"]
        return Evidence(
            source="kubernetes",
            summary=f"Kubernetes reports {len(unhealthy)} unhealthy pod(s) for {incident.service_name}.",
            details=k8s,
        )


class DeploymentHistoryAgent:
    name = "DeploymentHistoryAgent"

    def run(self, incident) -> Evidence:
        deployment = _scenario(incident)["deployment"]
        return Evidence(
            source="deployment_history",
            summary=f"Recent deployment signal: {deployment['message']} ({deployment['minutes_ago']} minutes ago).",
            details=deployment,
        )
