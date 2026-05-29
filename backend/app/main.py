import json
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from sqlalchemy.orm import Session
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.database import SessionLocal, init_db, Incident, RCAReport, RunbookExecution, EvidenceRecord, AgentTrace, TimelineEvent, Postmortem, EvaluationResult
from app.schemas import IncidentCreate, RunbookApproval, EvalRequest
from app.services.incident_service import IncidentService
from app.services.runbook_executor import RunbookExecutor
from app.services.evaluation_service import EvaluationService
from app.services.postmortem_service import PostmortemService
from app.services.scenario_service import list_scenarios, get_scenario
from app.metrics import RUNBOOK_REJECTIONS, INCIDENT_STATUS

app = FastAPI(title="AegisOps AI", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
FastAPIInstrumentor.instrument_app(app)

incident_service = IncidentService()
runbook_executor = RunbookExecutor()
evaluation_service = EvaluationService()
postmortem_service = PostmortemService()


@app.on_event("startup")
def startup() -> None:
    init_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _incident_dict(item: Incident) -> dict:
    return {
        "id": item.id, "title": item.title, "description": item.description, "service_name": item.service_name,
        "severity": item.severity, "status": item.status, "scenario_key": item.scenario_key,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "aegisops-ai-backend", "version": "0.2.0"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    incidents = db.query(Incident).all()
    open_count = sum(1 for item in incidents if item.status == "open")
    investigating_count = sum(1 for item in incidents if item.status == "investigating")
    resolved_count = sum(1 for item in incidents if item.status == "resolved")
    for status, count in [("open", open_count), ("investigating", investigating_count), ("resolved", resolved_count)]:
        INCIDENT_STATUS.labels(status=status).set(count)
    latest_rca = db.query(RCAReport).order_by(RCAReport.id.desc()).first()
    latest_eval = db.query(EvaluationResult).order_by(EvaluationResult.id.desc()).first()
    return {
        "total_incidents": len(incidents),
        "open": open_count,
        "investigating": investigating_count,
        "resolved": resolved_count,
        "runbook_executions": db.query(RunbookExecution).count(),
        "agent_traces": db.query(AgentTrace).count(),
        "latest_ai_confidence": latest_rca.confidence_score if latest_rca else None,
        "latest_eval_score": latest_eval.score if latest_eval else None,
    }


@app.get("/scenarios")
def scenarios():
    return list_scenarios()


@app.post("/incidents/from-scenario/{scenario_key}")
def create_from_scenario(scenario_key: str, db: Session = Depends(get_db)):
    scenario = get_scenario(scenario_key)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    payload = IncidentCreate(
        title=scenario["title"], description=scenario["description"], service_name=scenario["service_name"],
        severity=scenario["severity"], scenario_key=scenario_key,
    )
    incident = incident_service.create_incident(db, payload)
    return _incident_dict(incident)


@app.get("/incidents")
def list_incidents(db: Session = Depends(get_db)):
    return [_incident_dict(item) for item in incident_service.list_incidents(db)]


@app.get("/incidents/{incident_id}")
def incident_detail(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    rca = db.query(RCAReport).filter(RCAReport.incident_id == incident_id).order_by(RCAReport.id.desc()).first()
    postmortem = db.query(Postmortem).filter(Postmortem.incident_id == incident_id).order_by(Postmortem.id.desc()).first()
    return {
        "incident": _incident_dict(incident),
        "evidence": [{"source": e.source, "summary": e.summary, "details": json.loads(e.details)} for e in db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).order_by(EvidenceRecord.id.asc()).all()],
        "agent_traces": [{"agent_name": t.agent_name, "status": t.status, "latency_ms": t.latency_ms, "input_summary": t.input_summary, "output_summary": t.output_summary, "created_at": t.created_at.isoformat()} for t in db.query(AgentTrace).filter(AgentTrace.incident_id == incident_id).order_by(AgentTrace.id.asc()).all()],
        "rca": None if not rca else {"suspected_root_cause": rca.suspected_root_cause, "confidence_score": rca.confidence_score, "recommended_actions": json.loads(rca.recommended_actions), "risky_actions": json.loads(rca.risky_actions), "requires_human_approval": rca.requires_human_approval, "created_at": rca.created_at.isoformat()},
        "runbooks": [{"runbook_name": r.runbook_name, "approved_by": r.approved_by, "status": r.status, "result": r.result, "created_at": r.created_at.isoformat()} for r in db.query(RunbookExecution).filter(RunbookExecution.incident_id == incident_id).order_by(RunbookExecution.id.asc()).all()],
        "timeline": [{"event_type": x.event_type, "message": x.message, "actor": x.actor, "created_at": x.created_at.isoformat()} for x in db.query(TimelineEvent).filter(TimelineEvent.incident_id == incident_id).order_by(TimelineEvent.id.asc()).all()],
        "postmortem": None if not postmortem else postmortem.markdown,
    }


@app.post("/incidents")
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    return _incident_dict(incident_service.create_incident(db, payload))


@app.post("/incidents/{incident_id}/analyze")
async def analyze_incident(incident_id: int, db: Session = Depends(get_db)):
    try:
        return await incident_service.analyze_incident(db, incident_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/runbooks")
def list_runbooks():
    return runbook_executor.list_runbooks()


@app.post("/runbooks/approve")
def approve_runbook(payload: RunbookApproval, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == payload.incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    existing = db.query(RunbookExecution).filter(RunbookExecution.incident_id == incident.id, RunbookExecution.runbook_name == payload.runbook_name).first()
    if existing and incident.status == "resolved":
        return {"status": "already_resolved", "message": "Runbook was already executed for this resolved incident."}
    if not payload.approved:
        RUNBOOK_REJECTIONS.inc()
        db.add(TimelineEvent(incident_id=incident.id, event_type="runbook_rejected", message=f"{payload.runbook_name} rejected.", actor=payload.approved_by))
        db.commit()
        return {"status": "rejected", "message": "Runbook execution rejected by human reviewer."}
    try:
        result = runbook_executor.execute(payload.runbook_name, incident.service_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    incident.status = "resolved"
    db.add(RunbookExecution(incident_id=incident.id, runbook_name=payload.runbook_name, approved_by=payload.approved_by, status=result["status"], result=json.dumps(result)))
    db.add(TimelineEvent(incident_id=incident.id, event_type="runbook_executed", message=f"{payload.runbook_name} executed in simulation mode.", actor=payload.approved_by))
    db.commit()
    return result


@app.post("/incidents/{incident_id}/postmortem")
def generate_postmortem(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    markdown = postmortem_service.generate(db, incident)
    db.add(Postmortem(incident_id=incident.id, markdown=markdown))
    db.add(TimelineEvent(incident_id=incident.id, event_type="postmortem_generated", message="Postmortem generated.", actor="PostmortemAgent"))
    db.commit()
    return {"incident_id": incident.id, "markdown": markdown}


@app.post("/evals/rca")
def evaluate_rca(payload: EvalRequest):
    return evaluation_service.evaluate_rca(payload.predicted_root_cause, payload.expected_root_cause)


@app.post("/evals/run-benchmark")
def run_benchmark(db: Session = Depends(get_db)):
    return evaluation_service.run_benchmark(db)


@app.get("/evals")
def list_evals(db: Session = Depends(get_db)):
    return [{"name": e.name, "total_cases": e.total_cases, "passed_cases": e.passed_cases, "score": e.score, "created_at": e.created_at.isoformat(), "details": json.loads(e.details)} for e in db.query(EvaluationResult).order_by(EvaluationResult.id.desc()).all()]
