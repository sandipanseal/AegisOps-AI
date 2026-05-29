import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import Incident, RCAReport, EvidenceRecord, AgentTrace, TimelineEvent, ModelInvocation
from app.schemas import IncidentCreate
from app.services.evidence_collectors import LogAnalysisAgent, MetricsAnalysisAgent, KubernetesStateAgent, DeploymentHistoryAgent, RagMemoryAgent
from app.services.notification_service import NotificationService
from app.agents.rca_agent import RCAAgent
from app.agents.base import run_agent
from app.metrics import INCIDENTS_CREATED, INCIDENT_STATUS, RCA_REQUESTS, RCA_LATENCY, AI_CONFIDENCE_SCORE


class IncidentService:
    def __init__(self):
        self.collectors = [LogAnalysisAgent(), MetricsAnalysisAgent(), KubernetesStateAgent(), DeploymentHistoryAgent()]
        self.rag_collector = RagMemoryAgent()
        self.rca_agent = RCAAgent()
        self.notifications = NotificationService()

    def _timeline(self, db: Session, incident_id: int, event_type: str, message: str, actor: str = "system") -> None:
        db.add(TimelineEvent(incident_id=incident_id, event_type=event_type, message=message, actor=actor))

    def _refresh_status_metrics(self, db: Session) -> None:
        for status in ["open", "investigating", "resolved"]:
            count = db.query(Incident).filter(Incident.status == status).count()
            INCIDENT_STATUS.labels(status=status).set(count)

    def list_incidents(self, db: Session):
        return db.query(Incident).order_by(Incident.id.desc()).all()

    def create_incident(self, db: Session, payload: IncidentCreate) -> Incident:
        incident = Incident(
            title=payload.title,
            description=payload.description,
            service_name=payload.service_name,
            severity=payload.severity.value,
            status="open",
            scenario_key=payload.scenario_key,
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)
        INCIDENTS_CREATED.labels(severity=incident.severity, service=incident.service_name).inc()
        self._timeline(db, incident.id, "created", f"Incident created for {incident.service_name}.")
        self.notifications.notify_incident(db, incident, f"🚨 AegisOps incident #{incident.id}: {incident.title} on {incident.service_name} severity={incident.severity}")
        db.commit()
        self._refresh_status_metrics(db)
        return incident

    async def analyze_incident(self, db: Session, incident_id: int):
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError("Incident not found")

        incident.status = "investigating"
        incident.updated_at = datetime.utcnow()
        self._timeline(db, incident.id, "analysis_started", "Agentic RCA workflow started.", "IncidentCommanderAgent")
        db.commit()

        RCA_REQUESTS.inc()
        evidence = []
        with RCA_LATENCY.time():
            for collector in self.collectors:
                run = run_agent(
                    collector.name,
                    f"Analyze {collector.name} signals for {incident.service_name}",
                    lambda c=collector: c.run(incident),
                    lambda output: output.summary if hasattr(output, "summary") else str(output),
                )
                db.add(AgentTrace(incident_id=incident.id, agent_name=run.agent_name, status=run.status, latency_ms=run.latency_ms, input_summary=run.input_summary, output_summary=run.output_summary))
                if run.status == "success":
                    ev = run.output
                    evidence.append(ev)
                    db.add(EvidenceRecord(incident_id=incident.id, source=ev.source, summary=ev.summary, details=json.dumps(ev.details)))

            rag_run = run_agent(
                self.rag_collector.name,
                f"Retrieve relevant memory for {incident.service_name}",
                lambda: self.rag_collector.run(incident, db),
                lambda output: output.summary if hasattr(output, "summary") else str(output),
            )
            db.add(AgentTrace(incident_id=incident.id, agent_name=rag_run.agent_name, status=rag_run.status, latency_ms=rag_run.latency_ms, input_summary=rag_run.input_summary, output_summary=rag_run.output_summary))
            if rag_run.status == "success":
                ev = rag_run.output
                evidence.append(ev)
                db.add(EvidenceRecord(incident_id=incident.id, source=ev.source, summary=ev.summary, details=json.dumps(ev.details)))

            rca_run = run_agent(
                self.rca_agent.name,
                f"Synthesize RCA from {len(evidence)} evidence records",
                lambda: self.rca_agent.generate(incident, evidence),
                lambda output: output.suspected_root_cause[:220] if hasattr(output, "suspected_root_cause") else str(output),
            )
            db.add(AgentTrace(incident_id=incident.id, agent_name=rca_run.agent_name, status=rca_run.status, latency_ms=rca_run.latency_ms, input_summary=rca_run.input_summary, output_summary=rca_run.output_summary))
            rca = rca_run.output

        db.add(RCAReport(
            incident_id=incident.id,
            suspected_root_cause=rca.suspected_root_cause,
            confidence_score=rca.confidence_score,
            recommended_actions=json.dumps(rca.recommended_actions),
            risky_actions=json.dumps(rca.risky_actions),
            requires_human_approval=rca.requires_human_approval,
        ))
        model_call = self.rca_agent.last_model_invocation
        if model_call:
            db.add(ModelInvocation(
                incident_id=incident.id,
                provider=model_call.get("provider", "inferops"),
                model=model_call.get("model", "unknown"),
                latency_ms=model_call.get("latency_ms", 0.0),
                prompt_tokens=model_call.get("prompt_tokens", 0),
                completion_tokens=model_call.get("completion_tokens", 0),
                total_tokens=model_call.get("total_tokens", 0),
                cost_usd=model_call.get("cost_usd", 0.0),
                status=model_call.get("status", "success"),
            ))
            self._timeline(db, incident.id, "model_call", f"InferOps model call: {model_call.get('model')} cost=${model_call.get('cost_usd', 0):.6f}, latency={model_call.get('latency_ms', 0):.0f}ms.", "InferOpsGateway")
        AI_CONFIDENCE_SCORE.set(rca.confidence_score)
        self._timeline(db, incident.id, "analysis_completed", f"RCA completed with confidence {rca.confidence_score:.2f}.", "RCAAgent")
        self.notifications.notify_incident(db, incident, f"✅ RCA completed for incident #{incident.id}: confidence={rca.confidence_score:.2f}")
        db.commit()
        self._refresh_status_metrics(db)
        return rca
