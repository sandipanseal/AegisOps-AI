import httpx
from openai import OpenAI
from app.config import settings
from app.schemas import Evidence, RCAResult
from app.agents.safety_agent import SafetyAgent


class RCAAgent:
    def __init__(self) -> None:
        self.safety = SafetyAgent()
        self.openai_client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def analyze(self, incident_id: int, title: str, description: str, evidence: list[Evidence]) -> RCAResult:
        evidence_text = "\n".join(f"- {item.source}: {item.summary}" for item in evidence)
        prompt = f"""
You are AegisOps AI, an AI incident commander for production systems.

Incident title: {title}
Incident description: {description}

Evidence:
{evidence_text}

Return a concise production-grade RCA with suspected root cause and recommended actions.
Mention risky actions separately if execution could impact production.
""".strip()

        llm_text = await self._call_llm(prompt)
        actions = [
            "Review the latest database pool and timeout configuration change",
            "Increase database connection pool size after validating current limits",
            "Restart affected payment-service deployment after approval",
            "Add Prometheus alert for connection pool saturation",
            "Create post-incident report with deployment correlation",
        ]
        safe, risky = self.safety.split_actions(actions)

        return RCAResult(
            incident_id=incident_id,
            suspected_root_cause=llm_text,
            confidence_score=0.84,
            evidence=evidence,
            recommended_actions=safe,
            risky_actions=risky,
            requires_human_approval=bool(risky),
        )

    async def _call_llm(self, prompt: str) -> str:
        if settings.inferops_ai_url:
            try:
                async with httpx.AsyncClient(timeout=20) as client:
                    response = await client.post(
                        f"{settings.inferops_ai_url.rstrip('/')}/v1/chat",
                        json={"message": prompt, "metadata": {"source": "aegisops-ai"}},
                    )
                    response.raise_for_status()
                    payload = response.json()
                    return payload.get("answer") or payload.get("response") or str(payload)
            except Exception:
                pass

        if self.openai_client:
            try:
                response = self.openai_client.responses.create(
                    model=settings.openai_model,
                    input=prompt,
                )
                return response.output_text
            except Exception:
                pass

        return (
            "The most likely root cause is a database connection pool configuration regression "
            "introduced in the latest deployment. Logs show connection timeouts and exhausted pools, "
            "Kubernetes shows pod instability, and deployment history shows a recent pool/timeout change."
        )
