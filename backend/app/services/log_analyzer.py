from app.schemas import Evidence


class LogAnalyzer:
    def analyze(self, service_name: str) -> Evidence:
        fake_logs = [
            f"ERROR {service_name} Database connection timeout after 3000ms",
            f"WARN {service_name} Retry attempt 3 failed for /payments/charge",
            f"ERROR {service_name} ConnectionPool exhausted: active=50 idle=0",
            f"INFO {service_name} Deployment version 1.8.4 started 12 minutes ago",
        ]
        error_count = sum(1 for line in fake_logs if "ERROR" in line)
        return Evidence(
            source="logs",
            summary=(
                f"Found {error_count} critical log patterns for {service_name}: "
                "database timeouts and exhausted connection pool after deployment."
            ),
            details={"sample_logs": fake_logs, "error_count": error_count},
        )
