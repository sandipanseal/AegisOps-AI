"""Canary deployment analysis endpoints (feature 9)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas import CanaryRequest
from app.services import canary_service

router = APIRouter(tags=["canary"])


@router.post("/canary/analyze")
def analyze_canary(payload: CanaryRequest, db: Session = Depends(get_db)):
    baseline = payload.baseline.model_dump() if payload.baseline else None
    canary = payload.canary.model_dump() if payload.canary else None
    return canary_service.analyze(db, payload.service_name, baseline, canary, payload.incident_id)


@router.get("/canary/analyses")
def list_canary(db: Session = Depends(get_db)):
    return canary_service.list_analyses(db)
