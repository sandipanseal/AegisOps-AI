"""AI confidence explanation endpoint (feature 3)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.database import RCAReport

router = APIRouter(tags=["confidence"])


@router.get("/incidents/{incident_id}/confidence")
def incident_confidence(incident_id: int, db: Session = Depends(get_db)):
    rca = (
        db.query(RCAReport)
        .filter(RCAReport.incident_id == incident_id)
        .order_by(RCAReport.id.desc())
        .first()
    )
    if not rca:
        raise HTTPException(status_code=404, detail="No RCA for this incident yet")
    explanation = json.loads(rca.confidence_explanation) if rca.confidence_explanation else None
    return {
        "incident_id": incident_id,
        "confidence_score": rca.confidence_score,
        "explanation": explanation,
    }
