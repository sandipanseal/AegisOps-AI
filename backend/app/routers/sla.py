"""SLA tracking endpoints (feature 2)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.database import Incident
from app.data.sla_policies import SLA_POLICIES
from app.services import sla_service

router = APIRouter(tags=["sla"])


@router.get("/sla/policies")
def sla_policies():
    return SLA_POLICIES


@router.get("/sla/overview")
def sla_overview(db: Session = Depends(get_db)):
    return sla_service.overview(db)


@router.get("/incidents/{incident_id}/sla")
def incident_sla(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return sla_service.for_incident(incident)
