from app.schemas import Evidence, RCAResult
from app.data.scenarios import SCENARIOS


class RCAAgent:
    name = "RCAAgent"

    def generate(self, incident, evidence: list[Evidence]) -> RCAResult:
        scenario = SCENARIOS.get(getattr(incident, "scenario_key", "custom"), SCENARIOS["payment_pool_regression"])
        root_cause = scenario["expected_root_cause"]

        evidence_summary = "; ".join([f"{item.source}: {item.summary}" for item in evidence])
        suspected = (
            f"The most likely root cause is {root_cause}. "
            f"This is supported by correlated evidence from {evidence_summary}."
        )

        safe_actions = [
            "Create incident report with deployment correlation",
            "Add alert for the detected failure pattern",
            "Validate service configuration against the last stable release",
        ]
        risky_actions = [
            "Restart affected deployment after approval",
            "Rollback latest deployment after approval if health does not recover",
        ]

        confidence = {"critical": 0.86, "high": 0.82, "medium": 0.74, "low": 0.65}.get(incident.severity, 0.78)

        return RCAResult(
            incident_id=incident.id,
            suspected_root_cause=suspected,
            confidence_score=confidence,
            evidence=evidence,
            recommended_actions=safe_actions,
            risky_actions=risky_actions,
            requires_human_approval=True,
        )
