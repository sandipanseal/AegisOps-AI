"""Incident lifecycle workflow endpoints (feature 1)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.database import Incident
from app.schemas import IncidentTransition, IncidentAssign
from app.services import lifecycle_service

router = APIRouter(tags=["lifecycle"])


@router.get("/lifecycle/states")
def lifecycle_states():
    return {"states": lifecycle_service.STATES, "transitions": lifecycle_service.TRANSITIONS}


def _incident_or_404(db: Session, incident_id: int) -> Incident:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.get("/incidents/{incident_id}/lifecycle")
def get_lifecycle(incident_id: int, db: Session = Depends(get_db)):
    return lifecycle_service.lifecycle(db, _incident_or_404(db, incident_id))


@router.post("/incidents/{incident_id}/transition")
def transition(incident_id: int, payload: IncidentTransition, db: Session = Depends(get_db)):
    incident = _incident_or_404(db, incident_id)
    try:
        return lifecycle_service.transition(db, incident, payload.to_status, payload.actor, payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/incidents/{incident_id}/assign")
def assign(incident_id: int, payload: IncidentAssign, db: Session = Depends(get_db)):
    incident = _incident_or_404(db, incident_id)
    return lifecycle_service.assign(db, incident, payload.assignee, payload.actor)
