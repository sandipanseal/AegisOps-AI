from app.schemas import Evidence
from app.data.scenarios import SCENARIOS
from app.services.demo_service_client import DemoServiceClient


def _scenario(incident) -> dict:
    return SCENARIOS.get(getattr(incident, "scenario_key", "custom"), SCENARIOS["payment_pool_regression"])


class LogAnalysisAgent:
    name = "LogAnalysisAgent"

    def __init__(self) -> None:
        self.demo = DemoServiceClient()

    def run(self, incident) -> Evidence:
        live = self.demo.get(incident.service_name, "/logs")
        logs = live.get("logs", []) if live else _scenario(incident)["logs"]
        error_count = sum(1 for line in logs if "ERROR" in line or "WARN" in line)
        source = "live_demo_logs" if live else "scenario_logs"
        return Evidence(
            source="logs",
            summary=f"Found {error_count} warning/error log patterns for {incident.service_name}: {logs[0] if logs else 'no log lines'}",
            details={"source_mode": source, "sample_logs": logs, "error_count": error_count},
        )


class MetricsAnalysisAgent:
    name = "MetricsAnalysisAgent"

    def __init__(self) -> None:
        self.demo = DemoServiceClient()

    def run(self, incident) -> Evidence:
        live = self.demo.get(incident.service_name, "/signals")
        metrics = live.get("metrics", {}) if live else _scenario(incident)["metrics"]
        return Evidence(
            source="metrics",
            summary=f"p95 latency={metrics['p95_latency_ms']}ms, error rate={metrics['error_rate_pct']}%, memory={metrics['memory_pct']}%.",
            details={"source_mode": "live_demo_service" if live else "scenario_fixture", **metrics},
        )


class KubernetesStateAgent:
    name = "KubernetesStateAgent"

    def __init__(self) -> None:
        self.demo = DemoServiceClient()

    def run(self, incident) -> Evidence:
        live = self.demo.get(incident.service_name, "/signals")
        k8s = live.get("kubernetes", {}) if live else _scenario(incident)["kubernetes"]
        unhealthy = [pod for pod in k8s.get("pods", []) if pod.get("status") != "Running"]
        return Evidence(
            source="kubernetes",
            summary=f"Kubernetes reports {len(unhealthy)} unhealthy pod(s) for {incident.service_name}.",
            details={"source_mode": "live_demo_service" if live else "scenario_fixture", **k8s},
        )


class DeploymentHistoryAgent:
    name = "DeploymentHistoryAgent"

    def __init__(self) -> None:
        self.demo = DemoServiceClient()

    def run(self, incident) -> Evidence:
        live = self.demo.get(incident.service_name, "/signals")
        deployment = live.get("deployment", {}) if live else _scenario(incident)["deployment"]
        return Evidence(
            source="deployment_history",
            summary=f"Recent deployment signal: {deployment['message']} ({deployment['minutes_ago']} minutes ago).",
            details={"source_mode": "live_demo_service" if live else "scenario_fixture", **deployment},
        )
