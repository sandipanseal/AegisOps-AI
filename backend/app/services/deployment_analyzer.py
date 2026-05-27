from app.schemas import Evidence


class DeploymentAnalyzer:
    def analyze(self, service_name: str) -> Evidence:
        deployment = {
            "service": service_name,
            "commit": "a1b2c3d",
            "message": "Tune database pool size and timeout configuration",
            "deployed_at": "2026-05-27T10:15:00Z",
            "author": "platform-engineer",
        }
        return Evidence(
            source="deployment_history",
            summary=(
                f"Recent deployment for {service_name} changed database pool and timeout settings. "
                "This correlates with the observed connection pool failures."
            ),
            details={"latest_deployment": deployment},
        )
