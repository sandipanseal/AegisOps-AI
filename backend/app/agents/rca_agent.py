from app.schemas import Evidence, RCAResult
from app.data.scenarios import SCENARIOS
from app.services.inferops_client import InferOpsClient
from app.services.openai_client import OpenAIClient
from app.services import confidence_service


class RCAAgent:
    name = "RCAAgent"

    def __init__(self) -> None:
        self.inferops = InferOpsClient()
        self.openai = OpenAIClient()
        self.last_model_invocation = None

    def generate(self, incident, evidence: list[Evidence]) -> RCAResult:
        scenario = SCENARIOS.get(getattr(incident, "scenario_key", "custom"), SCENARIOS["payment_pool_regression"])
        expected_root_cause = scenario["expected_root_cause"]
        evidence_summary = "; ".join([f"{item.source}: {item.summary}" for item in evidence])

        prompt = f"""
You are AegisOps AI, an agentic incident commander for production systems.

Incident:
- Title: {incident.title}
- Service: {incident.service_name}
- Severity: {incident.severity}
- Description: {incident.description}

Evidence collected by agents:
{evidence_summary}

Task:
Produce a concise SRE-style root-cause analysis. Include the likely root cause,
why the evidence supports it, and the safest next operational actions. Do not
recommend destructive action without human approval.
""".strip()

        # Prefer a live InferOps AI gateway when one is configured; otherwise fall
        # back to a direct OpenAI call so the real-model path (and its cost/latency
        # tracking) still works with just OPENAI_API_KEY set.
        gateway_result = self.inferops.synthesize_rca_with_metadata(prompt)
        if not gateway_result:
            gateway_result = self.openai.synthesize_rca_with_metadata(prompt)
        self.last_model_invocation = gateway_result
        gateway_text = gateway_result["text"] if gateway_result else None
        used_llm = bool(gateway_text)
        if gateway_text:
            suspected = gateway_text[:1800]
        else:
            suspected = (
                f"The most likely root cause is {expected_root_cause}. "
                f"This is supported by correlated evidence from {evidence_summary}."
            )

        # Confidence and its human-readable explanation are produced together so the
        # score and the factor breakdown can never disagree (feature 3).
        assessment = confidence_service.assess(incident, evidence, used_llm)
        confidence = assessment["score"]

        safe_actions = [
            "Create incident report with deployment correlation",
            "Add alert for the detected failure pattern",
            "Validate service configuration against the last stable release",
            "Compare current service metrics against the last stable baseline",
        ]
        risky_actions = [
            "Restart affected deployment after approval",
            "Rollback latest deployment after approval if health does not recover",
        ]

        return RCAResult(
            incident_id=incident.id,
            suspected_root_cause=suspected,
            confidence_score=confidence,
            evidence=evidence,
            recommended_actions=safe_actions,
            risky_actions=risky_actions,
            requires_human_approval=True,
            confidence_explanation=assessment,
        )
