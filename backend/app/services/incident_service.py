from sqlalchemy.orm import Session
from app.database import Incident, RCAReport
from app.schemas import IncidentCreate
from app.services.log_analyzer import LogAnalyzer
from app.services.metric_analyzer import MetricAnalyzer
from app.services.k8s_analyzer import KubernetesAnalyzer
from app.services.deployment_analyzer import DeploymentAnalyzer
from app.agents.rca_agent import RCAAgent
from app.metrics import INCIDENTS_CREATED, RCA_REQUESTS, RCA_LATENCY, AI_CONFIDENCE_SCORE


class IncidentService:
    def __init__(self) -> None:
        self.log_analyzer = LogAnalyzer()
        self.metric_analyzer = MetricAnalyzer()
        self.k8s_analyzer = KubernetesAnalyzer()
        self.deployment_analyzer = DeploymentAnalyzer()
        self.rca_agent = RCAAgent()

    def create_incident(self, db: Session, payload: IncidentCreate) -> Incident:
        incident = Incident(
            title=payload.title,
            description=payload.description,
            service_name=payload.service_name,
            severity=payload.severity.value,
            status="open",
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)
        INCIDENTS_CREATED.inc()
        return incident

    def list_incidents(self, db: Session) -> list[Incident]:
        return db.query(Incident).order_by(Incident.id.desc()).all()

    async def analyze_incident(self, db: Session, incident_id: int):
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if incident is None:
            raise ValueError("Incident not found")

        RCA_REQUESTS.inc()
        with RCA_LATENCY.time():
            evidence = [
                self.log_analyzer.analyze(incident.service_name),
                await self.metric_analyzer.analyze(incident.service_name),
                self.k8s_analyzer.analyze(incident.service_name),
                self.deployment_analyzer.analyze(incident.service_name),
            ]
            rca = await self.rca_agent.analyze(
                incident_id=incident.id,
                title=incident.title,
                description=incident.description,
                evidence=evidence,
            )

        AI_CONFIDENCE_SCORE.set(rca.confidence_score)
        incident.status = "action_pending" if rca.requires_human_approval else "analyzed"

        report = RCAReport(
            incident_id=incident.id,
            suspected_root_cause=rca.suspected_root_cause,
            confidence_score=rca.confidence_score,
            recommended_actions="\n".join(rca.recommended_actions),
            risky_actions="\n".join(rca.risky_actions),
            requires_human_approval=rca.requires_human_approval,
        )
        db.add(report)
        db.commit()
        return rca
