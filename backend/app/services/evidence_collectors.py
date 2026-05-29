from sqlalchemy.orm import Session
from app.schemas import Evidence
from app.data.scenarios import SCENARIOS
from app.services.service_client import ServiceClient
from app.services.loki_client import LokiClient
from app.services.kubernetes_adapter import KubernetesAdapter
from app.services.rag_service import RagService


def _scenario(incident) -> dict:
    return SCENARIOS.get(getattr(incident, "scenario_key", "custom"), SCENARIOS["payment_pool_regression"])


class LogAnalysisAgent:
    name = "LogAnalysisAgent"

    def __init__(self) -> None:
        self.service = ServiceClient()
        self.loki = LokiClient()

    def run(self, incident) -> Evidence:
        loki_logs = self.loki.search_logs(incident.service_name, minutes=120)
        live = self.service.get(incident.service_name, "/logs")
        if loki_logs:
            logs = loki_logs
            source = "loki"
        elif live:
            logs = live.get("logs", [])
            source = "live_service_logs"
        else:
            logs = _scenario(incident)["logs"]
            source = "scenario_logs"
        error_count = sum(1 for line in logs if "ERROR" in line or "WARN" in line or "timeout" in line.lower())
        return Evidence(
            source="logs",
            summary=f"Log search via {source} found {error_count} warning/error patterns for {incident.service_name}: {logs[0] if logs else 'no log lines'}",
            details={"source_mode": source, "sample_logs": logs[:20], "error_count": error_count},
        )


class MetricsAnalysisAgent:
    name = "MetricsAnalysisAgent"

    def __init__(self) -> None:
        self.service = ServiceClient()

    def run(self, incident) -> Evidence:
        live = self.service.get(incident.service_name, "/signals")
        metrics = live.get("metrics", {}) if live else _scenario(incident)["metrics"]
        return Evidence(
            source="metrics",
            summary=f"p95 latency={metrics['p95_latency_ms']}ms, error rate={metrics['error_rate_pct']}%, memory={metrics['memory_pct']}%.",
            details={"source_mode": "live_service" if live else "scenario_fixture", **metrics},
        )


class KubernetesStateAgent:
    name = "KubernetesStateAgent"

    def __init__(self) -> None:
        self.service = ServiceClient()
        self.k8s = KubernetesAdapter()

    def run(self, incident) -> Evidence:
        cluster = self.k8s.service_status(incident.service_name)
        if cluster and cluster.get("pods"):
            k8s = cluster
            mode = "kind_or_cluster"
        else:
            live = self.service.get(incident.service_name, "/signals")
            k8s = live.get("kubernetes", {}) if live else _scenario(incident)["kubernetes"]
            mode = "live_service" if live else "scenario_fixture"
        unhealthy = [pod for pod in k8s.get("pods", []) if pod.get("status") not in {"Running", "Succeeded"}]
        return Evidence(
            source="kubernetes",
            summary=f"Kubernetes adapter reports {len(unhealthy)} unhealthy pod(s) for {incident.service_name} using {mode}.",
            details={"source_mode": mode, **k8s},
        )


class DeploymentHistoryAgent:
    name = "DeploymentHistoryAgent"

    def __init__(self) -> None:
        self.service = ServiceClient()

    def run(self, incident) -> Evidence:
        live = self.service.get(incident.service_name, "/signals")
        deployment = live.get("deployment", {}) if live else _scenario(incident)["deployment"]
        return Evidence(
            source="deployment_history",
            summary=f"Recent deployment signal: {deployment['message']} ({deployment['minutes_ago']} minutes ago).",
            details={"source_mode": "live_service" if live else "scenario_fixture", **deployment},
        )


class RagMemoryAgent:
    name = "RagMemoryAgent"

    def __init__(self) -> None:
        self.rag = RagService()

    def run(self, incident, db: Session) -> Evidence:
        query = f"{incident.service_name} {incident.title} {incident.description} {incident.severity} runbook previous incident"
        matches = self.rag.search(db, query, limit=5)
        return Evidence(
            source="rag_memory",
            summary=f"Retrieved {len(matches)} previous incidents/runbooks relevant to {incident.service_name}.",
            details={"query": query, "matches": matches},
        )
