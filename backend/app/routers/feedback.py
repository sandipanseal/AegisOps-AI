"""Human RCA feedback endpoints (feature 5)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.database import Incident, RCAReport, RCAFeedback, EvidenceRecord, TimelineEvent
from app.schemas import RCAFeedbackCreate
from app.services import eval_dataset_service
from app.metrics import RCA_FEEDBACK

router = APIRouter(tags=["rca-feedback"])

_VALID_VERDICTS = {"accurate", "partially_accurate", "inaccurate"}


def _serialize(row: RCAFeedback) -> dict:
    return {
        "id": row.id,
        "incident_id": row.incident_id,
        "rca_id": row.rca_id,
        "verdict": row.verdict,
        "rating": row.rating,
        "corrected_root_cause": row.corrected_root_cause,
        "comment": row.comment,
        "reviewer": row.reviewer,
        "promoted_to_eval": row.promoted_to_eval,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("/incidents/{incident_id}/rca-feedback")
def submit_feedback(incident_id: int, payload: RCAFeedbackCreate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if payload.verdict not in _VALID_VERDICTS:
        raise HTTPException(status_code=400, detail=f"verdict must be one of {sorted(_VALID_VERDICTS)}")
    if payload.rating is not None and not (1 <= payload.rating <= 5):
        raise HTTPException(status_code=400, detail="rating must be between 1 and 5")

    rca = db.query(RCAReport).filter(RCAReport.incident_id == incident_id).order_by(RCAReport.id.desc()).first()
    feedback = RCAFeedback(
        incident_id=incident_id,
        rca_id=rca.id if rca else None,
        verdict=payload.verdict,
        rating=payload.rating,
        corrected_root_cause=payload.corrected_root_cause,
        comment=payload.comment,
        reviewer=payload.reviewer,
    )
    db.add(feedback)
    db.add(TimelineEvent(incident_id=incident_id, event_type="rca_feedback", message=f"RCA marked '{payload.verdict}' by {payload.reviewer}.", actor=payload.reviewer))
    RCA_FEEDBACK.labels(verdict=payload.verdict).inc()
    db.commit()
    db.refresh(feedback)

    promoted = None
    # A human correction becomes a new benchmark case (closes the eval loop, feature 8).
    if payload.promote_to_eval and payload.corrected_root_cause:
        logs = []
        log_ev = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id, EvidenceRecord.source == "logs").first()
        if log_ev:
            logs = (json.loads(log_ev.details).get("sample_logs") or [])[:5]
        promoted = eval_dataset_service.create_from_feedback(db, incident, payload.corrected_root_cause, logs)
        feedback.promoted_to_eval = True
        db.commit()

    return {"feedback": _serialize(feedback), "promoted_eval_case": promoted}


@router.get("/incidents/{incident_id}/rca-feedback")
def list_incident_feedback(incident_id: int, db: Session = Depends(get_db)):
    rows = db.query(RCAFeedback).filter(RCAFeedback.incident_id == incident_id).order_by(RCAFeedback.id.desc()).all()
    return [_serialize(r) for r in rows]


@router.get("/rca-feedback")
def list_all_feedback(db: Session = Depends(get_db)):
    rows = db.query(RCAFeedback).order_by(RCAFeedback.id.desc()).all()
    return [_serialize(r) for r in rows]
