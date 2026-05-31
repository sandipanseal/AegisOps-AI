import json
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from sqlalchemy.orm import Session
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.database import SessionLocal, init_db, Incident, RCAReport, RunbookExecution, EvidenceRecord, AgentTrace, TimelineEvent, Postmortem, EvaluationResult, NotificationEvent, ModelInvocation, IncidentStateTransition
from app.schemas import IncidentCreate, RunbookApproval, EvalRequest
from app.deps import get_db
from app.services.incident_service import IncidentService
from app.services.runbook_executor import RunbookExecutor
from app.services.evaluation_service import EvaluationService
from app.services.postmortem_service import PostmortemService
from app.services.scenario_service import list_scenarios, get_scenario
from app.services import tool_faults, runbook_risk_service
from app.routers import ALL_ROUTERS
from app.config import cors_origins_list
from app.metrics import RUNBOOK_REJECTIONS, INCIDENT_STATUS, INCIDENT_TRANSITIONS

app = FastAPI(title="AegisOps AI", version="1.0.0")
# Explicit allow-list (configurable via CORS_ALLOW_ORIGINS) instead of the "*" wildcard.
app.add_middleware(CORSMiddleware, allow_origins=cors_origins_list(), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
FastAPIInstrumentor.instrument_app(app)

for _router in ALL_ROUTERS:
    app.include_router(_router)

incident_service = IncidentService()
runbook_executor = RunbookExecutor()
evaluation_service = EvaluationService()
postmortem_service = PostmortemService()


@app.on_event("startup")
def startup() -> None:
    init_db()
    # Rehydrate simulated tool-fault state (feature 6) from the database.
    db = SessionLocal()
    try:
        tool_faults.load_from_db(db)
    finally:
        db.close()


def _incident_dict(item: Incident) -> dict:
    return {
        "id": item.id, "title": item.title, "description": item.description, "service_name": item.service_name,
        "severity": item.severity, "status": item.status, "scenario_key": item.scenario_key,
        "assignee": item.assignee,
        "acknowledged_at": item.acknowledged_at.isoformat() if item.acknowledged_at else None,
        "resolved_at": item.resolved_at.isoformat() if item.resolved_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "aegisops-ai-backend", "version": "1.0.0"}


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
        "model_invocations": db.query(ModelInvocation).count(),
        "model_cost_usd": round(sum(x.cost_usd or 0 for x in db.query(ModelInvocation).all()), 6),
        "notifications": db.query(NotificationEvent).count(),
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
        "rca": None if not rca else {"suspected_root_cause": rca.suspected_root_cause, "confidence_score": rca.confidence_score, "recommended_actions": json.loads(rca.recommended_actions), "risky_actions": json.loads(rca.risky_actions), "requires_human_approval": rca.requires_human_approval, "confidence_explanation": json.loads(rca.confidence_explanation) if rca.confidence_explanation else None, "created_at": rca.created_at.isoformat()},
        "runbooks": [{"runbook_name": r.runbook_name, "approved_by": r.approved_by, "status": r.status, "result": r.result, "risk_score": r.risk_score, "created_at": r.created_at.isoformat()} for r in db.query(RunbookExecution).filter(RunbookExecution.incident_id == incident_id).order_by(RunbookExecution.id.asc()).all()],
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
        risk = runbook_risk_service.score_runbook({**runbook_executor.load(payload.runbook_name), "key": payload.runbook_name})
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result["risk"] = risk
    previous_status = incident.status
    now = datetime.utcnow()
    if incident.acknowledged_at is None:
        incident.acknowledged_at = now
    incident.status = "resolved"
    incident.resolved_at = now
    incident.updated_at = now
    db.add(IncidentStateTransition(incident_id=incident.id, from_status=previous_status, to_status="resolved", actor=payload.approved_by, note=f"Resolved via runbook {payload.runbook_name}."))
    INCIDENT_TRANSITIONS.labels(from_status=previous_status, to_status="resolved").inc()
    db.add(RunbookExecution(incident_id=incident.id, runbook_name=payload.runbook_name, approved_by=payload.approved_by, status=result["status"], result=json.dumps(result), risk_score=risk["risk_score"]))
    db.add(TimelineEvent(incident_id=incident.id, event_type="runbook_executed", message=f"{payload.runbook_name} executed in simulation mode (risk {risk['risk_score']}/100).", actor=payload.approved_by))
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

@app.post("/services/{service_name}/simulate-failure")
def simulate_service_failure(service_name: str):
    from app.services.service_client import ServiceClient
    from app.metrics import SERVICE_FAULTS

    client = ServiceClient()
    result = client.post(service_name, "/simulate-failure")
    if not result:
        raise HTTPException(status_code=502, detail=f"Service {service_name} did not respond")
    SERVICE_FAULTS.labels(service=service_name, mode=result.get("mode", "unknown")).inc()
    logs_payload = client.get(service_name, "/logs") or {"logs": []}
    from app.services.loki_client import LokiClient
    loki_result = LokiClient().push_logs(service_name, logs_payload.get("logs", []))
    return {**result, "loki": loki_result}


@app.post("/services/{service_name}/reset")
def reset_service(service_name: str):
    from app.services.service_client import ServiceClient

    result = ServiceClient().post(service_name, "/reset")
    if not result:
        raise HTTPException(status_code=502, detail=f"Service {service_name} did not respond")
    return result


@app.get("/services/{service_name}/signals")
def service_signals(service_name: str):
    from app.services.service_client import ServiceClient

    result = ServiceClient().get(service_name, "/signals")
    if not result:
        raise HTTPException(status_code=502, detail=f"Service {service_name} did not respond")
    return result


@app.get("/logs/search")
def search_loki_logs(service_name: str, minutes: int = 60):
    from app.services.loki_client import LokiClient
    return {"service_name": service_name, "logs": LokiClient().search_logs(service_name, minutes=minutes)}


@app.get("/kubernetes/{service_name}/status")
def kubernetes_status(service_name: str, namespace: str = "default"):
    from app.services.kubernetes_adapter import KubernetesAdapter
    result = KubernetesAdapter().service_status(service_name, namespace=namespace)
    if result is None:
        return {"status": "disabled", "message": "Set ENABLE_K8S_ADAPTER=true and provide kubeconfig/in-cluster access to use the Kind/Kubernetes adapter."}
    return result


@app.post("/notifications/test")
def test_notifications(db: Session = Depends(get_db)):
    from app.services.notification_service import NotificationService
    probe = type("IncidentLike", (), {"id": None, "title": "Manual notification test", "service_name": "aegisops-ai", "severity": "high"})()
    results = NotificationService().notify_incident(db, probe, "🔔 AegisOps AI notification integration test")
    db.commit()
    return {"results": results}


@app.post("/rag/reindex")
def rag_reindex(db: Session = Depends(get_db)):
    from app.services.rag_service import RagService
    return RagService().reindex(db)


@app.get("/rag/search")
def rag_search(query: str, limit: int = 5, db: Session = Depends(get_db)):
    from app.services.rag_service import RagService
    return {"query": query, "results": RagService().search(db, query, limit=limit)}


@app.get("/model-usage")
def model_usage(db: Session = Depends(get_db)):
    rows = db.query(ModelInvocation).order_by(ModelInvocation.id.desc()).all()
    total_cost = sum(row.cost_usd or 0 for row in rows)
    total_tokens = sum(row.total_tokens or 0 for row in rows)
    return {
        "total_calls": len(rows),
        "total_cost_usd": round(total_cost, 6),
        "total_tokens": total_tokens,
        "calls": [
            {
                "incident_id": r.incident_id,
                "provider": r.provider,
                "model": r.model,
                "latency_ms": r.latency_ms,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "cost_usd": r.cost_usd,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            } for r in rows
        ],
    }


@app.get("/notifications")
def list_notifications(db: Session = Depends(get_db)):
    rows = db.query(NotificationEvent).order_by(NotificationEvent.id.desc()).all()
    return [{"incident_id": r.incident_id, "channel": r.channel, "status": r.status, "payload": json.loads(r.payload), "response": json.loads(r.response), "created_at": r.created_at.isoformat()} for r in rows]
