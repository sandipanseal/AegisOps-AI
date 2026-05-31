"""Incident lifecycle workflow (feature 1).

A defined state machine for incidents (open → acknowledged → investigating →
identified → mitigating → resolved → closed) with validated transitions, an audit
trail, and lifecycle-timestamp side effects that feed SLA tracking.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.database import Incident, IncidentStateTransition, TimelineEvent
from app.data.sla_policies import policy_for
from app.metrics import INCIDENT_TRANSITIONS, TIME_TO_ACKNOWLEDGE, TIME_TO_RESOLVE, SLA_BREACHES

STATES = ["open", "acknowledged", "investigating", "identified", "mitigating", "resolved", "closed"]

TRANSITIONS: dict[str, list[str]] = {
    "open": ["acknowledged", "investigating", "resolved", "closed"],
    "acknowledged": ["investigating", "mitigating", "resolved", "closed"],
    "investigating": ["acknowledged", "identified", "mitigating", "resolved"],
    "identified": ["investigating", "mitigating", "resolved"],
    "mitigating": ["investigating", "identified", "resolved"],
    "resolved": ["closed", "investigating"],
    "closed": ["investigating"],
}


def allowed_next(status: str) -> list[str]:
    return TRANSITIONS.get(status, [])


def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in TRANSITIONS.get(from_status, [])


def transition(db: Session, incident: Incident, to_status: str, actor: str = "sre-oncall", note: str | None = None) -> dict:
    from_status = incident.status
    if to_status not in STATES:
        raise ValueError(f"Unknown status '{to_status}'. Valid states: {', '.join(STATES)}")
    if to_status == from_status:
        raise ValueError(f"Incident is already '{to_status}'.")
    if not can_transition(from_status, to_status):
        raise ValueError(f"Illegal transition '{from_status}' → '{to_status}'. Allowed: {', '.join(allowed_next(from_status)) or 'none'}")

    now = datetime.utcnow()
    created = incident.created_at or now

    # lifecycle-timestamp side effects (feed SLA tracking)
    if to_status in ("acknowledged", "investigating") and incident.acknowledged_at is None:
        incident.acknowledged_at = now
        elapsed = (now - created).total_seconds()
        TIME_TO_ACKNOWLEDGE.observe(elapsed)
        if elapsed > policy_for(incident.severity)["ack_minutes"] * 60:
            SLA_BREACHES.labels(stage="acknowledge", severity=incident.severity).inc()
    if to_status == "resolved":
        if incident.resolved_at is None:
            incident.resolved_at = now
            elapsed = (now - created).total_seconds()
            TIME_TO_RESOLVE.observe(elapsed)
            if elapsed > policy_for(incident.severity)["resolve_minutes"] * 60:
                SLA_BREACHES.labels(stage="resolve", severity=incident.severity).inc()
    if to_status in ("investigating",) and from_status in ("resolved", "closed"):
        # reopened
        incident.resolved_at = None

    incident.status = to_status
    incident.updated_at = now
    db.add(IncidentStateTransition(incident_id=incident.id, from_status=from_status, to_status=to_status, actor=actor, note=note))
    db.add(TimelineEvent(incident_id=incident.id, event_type="status_changed", message=f"Status {from_status} → {to_status}" + (f": {note}" if note else ""), actor=actor))
    INCIDENT_TRANSITIONS.labels(from_status=from_status, to_status=to_status).inc()
    db.commit()
    db.refresh(incident)
    return lifecycle(db, incident)


def assign(db: Session, incident: Incident, assignee: str, actor: str = "sre-oncall") -> dict:
    incident.assignee = assignee
    incident.updated_at = datetime.utcnow()
    db.add(TimelineEvent(incident_id=incident.id, event_type="assigned", message=f"Incident assigned to {assignee}.", actor=actor))
    db.commit()
    db.refresh(incident)
    return lifecycle(db, incident)


def lifecycle(db: Session, incident: Incident) -> dict:
    transitions = db.query(IncidentStateTransition).filter(IncidentStateTransition.incident_id == incident.id).order_by(IncidentStateTransition.id.asc()).all()
    return {
        "incident_id": incident.id,
        "status": incident.status,
        "assignee": incident.assignee,
        "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "allowed_next": allowed_next(incident.status),
        "states": STATES,
        "transitions": [
            {"from_status": t.from_status, "to_status": t.to_status, "actor": t.actor, "note": t.note, "created_at": t.created_at.isoformat() if t.created_at else None}
            for t in transitions
        ],
    }
