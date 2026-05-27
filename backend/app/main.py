from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from sqlalchemy.orm import Session
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.database import SessionLocal, init_db, Incident, RunbookExecution
from app.schemas import IncidentCreate, RunbookApproval, EvalRequest
from app.services.incident_service import IncidentService
from app.services.runbook_executor import RunbookExecutor
from app.services.evaluation_service import EvaluationService
from app.metrics import RUNBOOK_REJECTIONS

app = FastAPI(title="AegisOps AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
FastAPIInstrumentor.instrument_app(app)

incident_service = IncidentService()
runbook_executor = RunbookExecutor()
evaluation_service = EvaluationService()


@app.on_event("startup")
def startup() -> None:
    init_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "healthy", "service": "aegisops-ai-backend"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/incidents")
def list_incidents(db: Session = Depends(get_db)):
    incidents = incident_service.list_incidents(db)
    return [
        {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "service_name": item.service_name,
            "severity": item.severity,
            "status": item.status,
        }
        for item in incidents
    ]


@app.post("/incidents")
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    incident = incident_service.create_incident(db, payload)
    return {
        "id": incident.id,
        "title": incident.title,
        "description": incident.description,
        "service_name": incident.service_name,
        "severity": incident.severity,
        "status": incident.status,
    }


@app.post("/incidents/{incident_id}/analyze")
async def analyze_incident(incident_id: int, db: Session = Depends(get_db)):
    try:
        return await incident_service.analyze_incident(db, incident_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/runbooks/approve")
def approve_runbook(payload: RunbookApproval, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == payload.incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    if not payload.approved:
        RUNBOOK_REJECTIONS.inc()
        return {"status": "rejected", "message": "Runbook execution rejected by human reviewer."}

    try:
        result = runbook_executor.execute(payload.runbook_name, incident.service_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    incident.status = "resolved"
    execution = RunbookExecution(
        incident_id=incident.id,
        runbook_name=payload.runbook_name,
        approved_by=payload.approved_by,
        status=result["status"],
        result=str(result),
    )
    db.add(execution)
    db.commit()
    return result


@app.post("/evals/rca")
def evaluate_rca(payload: EvalRequest):
    return evaluation_service.evaluate_rca(
        predicted_root_cause=payload.predicted_root_cause,
        expected_root_cause=payload.expected_root_cause,
    )


@app.get("/demo/incident")
def demo_incident():
    return {
        "title": "Payment API latency spike",
        "description": "Payment service latency increased by 400% after latest deployment.",
        "service_name": "payment-service",
        "severity": "critical",
    }
