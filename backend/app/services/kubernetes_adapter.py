from __future__ import annotations

from app.config import settings
from app.metrics import K8S_ADAPTER_CALLS, TOOL_FAILURES
from app.services import tool_faults


class KubernetesAdapter:
    """Adapter for a local Kind cluster or in-cluster Kubernetes API.

    Enable with ENABLE_K8S_ADAPTER=true. For Kind, run backend locally or mount
    your kubeconfig into the backend container and set KUBECONFIG_PATH.
    """

    def __init__(self) -> None:
        self.enabled = bool(settings.enable_k8s_adapter)
        self._loaded = False
        self._core = None
        self._apps = None

    def _load(self) -> bool:
        if not self.enabled:
            return False
        if self._loaded:
            return True
        try:
            from kubernetes import client, config

            if settings.kubeconfig_path:
                config.load_kube_config(config_file=settings.kubeconfig_path)
            else:
                try:
                    config.load_incluster_config()
                except Exception:
                    config.load_kube_config()
            self._core = client.CoreV1Api()
            self._apps = client.AppsV1Api()
            self._loaded = True
            return True
        except Exception:
            TOOL_FAILURES.labels(tool="kubernetes_adapter_load").inc()
            return False

    def service_status(self, service_name: str, namespace: str = "default") -> dict | None:
        if tool_faults.is_active("kubernetes"):
            tool_faults.record_fallback("kubernetes")
            K8S_ADAPTER_CALLS.labels(status="disabled").inc()
            return None
        if not self._load():
            K8S_ADAPTER_CALLS.labels(status="disabled").inc()
            return None
        try:
            label_selector = f"app={service_name}"
            pods = self._core.list_namespaced_pod(namespace=namespace, label_selector=label_selector).items
            events = self._core.list_namespaced_event(namespace=namespace).items
            deployments = self._apps.list_namespaced_deployment(namespace=namespace, label_selector=label_selector).items

            pod_rows = []
            pod_names = set()
            for pod in pods:
                pod_names.add(pod.metadata.name)
                restarts = 0
                if pod.status.container_statuses:
                    restarts = sum(cs.restart_count for cs in pod.status.container_statuses)
                pod_rows.append({"name": pod.metadata.name, "status": pod.status.phase, "restarts": restarts})

            event_rows = []
            for event in events:
                involved = getattr(event.involved_object, "name", "") or ""
                if involved in pod_names or service_name in involved:
                    event_rows.append({"reason": event.reason, "message": event.message, "type": event.type})

            deploy_rows = []
            for dep in deployments:
                deploy_rows.append({
                    "name": dep.metadata.name,
                    "ready_replicas": dep.status.ready_replicas or 0,
                    "replicas": dep.status.replicas or 0,
                    "updated_replicas": dep.status.updated_replicas or 0,
                })
            K8S_ADAPTER_CALLS.labels(status="success").inc()
            return {"source_mode": "kind_or_cluster", "namespace": namespace, "pods": pod_rows, "events": event_rows, "deployments": deploy_rows}
        except Exception as exc:
            K8S_ADAPTER_CALLS.labels(status="failed").inc()
            TOOL_FAILURES.labels(tool="kubernetes_adapter_query").inc()
            return {"source_mode": "kind_or_cluster", "error": str(exc), "pods": [], "events": [], "deployments": []}
