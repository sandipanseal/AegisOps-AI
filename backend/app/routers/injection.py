"""Prompt-injection detection endpoints (feature 7)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db
from app.database import PromptInjectionDetection
from app.schemas import InjectionScanRequest
from app.services import injection_detector
from app.metrics import PROMPT_INJECTIONS

router = APIRouter(tags=["prompt-injection"])


def _serialize(row: PromptInjectionDetection) -> dict:
    return {
        "id": row.id,
        "incident_id": row.incident_id,
        "source": row.source,
        "line": row.line,
        "pattern": row.pattern,
        "severity": row.severity,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("/logs/scan-injection")
def scan_injection(payload: InjectionScanRequest, db: Session = Depends(get_db)):
    clean, detections = injection_detector.sanitize(payload.lines, source=payload.source)
    for det in detections:
        PROMPT_INJECTIONS.labels(severity=det["severity"]).inc()
        if payload.incident_id is not None:
            db.add(PromptInjectionDetection(incident_id=payload.incident_id, source=det["source"], line=det["line"], pattern=det["pattern"], severity=det["severity"]))
    if payload.incident_id is not None and detections:
        db.commit()
    return {
        "scanned_lines": len(payload.lines),
        "detections": detections,
        "highest_severity": injection_detector.highest_severity(detections),
        "sanitized_lines": clean,
    }


@router.get("/incidents/{incident_id}/injection-detections")
def incident_detections(incident_id: int, db: Session = Depends(get_db)):
    rows = db.query(PromptInjectionDetection).filter(PromptInjectionDetection.incident_id == incident_id).order_by(PromptInjectionDetection.id.desc()).all()
    return [_serialize(r) for r in rows]


@router.get("/injection-detections")
def all_detections(db: Session = Depends(get_db)):
    rows = db.query(PromptInjectionDetection).order_by(PromptInjectionDetection.id.desc()).all()
    return [_serialize(r) for r in rows]
