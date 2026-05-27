from app.schemas import Evidence


class KubernetesAnalyzer:
    def analyze(self, service_name: str) -> Evidence:
        pod_status = [
            {"name": f"{service_name}-7c9d9", "status": "Running", "restarts": 4, "ready": True},
            {"name": f"{service_name}-8a2d1", "status": "CrashLoopBackOff", "restarts": 9, "ready": False},
        ]
        return Evidence(
            source="kubernetes",
            summary=(
                f"Kubernetes state shows one unhealthy pod for {service_name} in CrashLoopBackOff "
                "with high restart count."
            ),
            details={"pods": pod_status},
        )
