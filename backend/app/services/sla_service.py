"""SLA tracking (feature 2).

Computes time-to-acknowledge / time-to-resolve against per-severity policies,
plus live remaining budget and breach state, for a single incident or the fleet.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.database import Incident
from app.data.sla_policies import policy_for
from app.metrics import SLA_BREACHES, SLA_COMPLIANCE


def _stage(created_at: datetime, completed_at: datetime | None, budget_minutes: int, now: datetime) -> dict:
    deadline = created_at + timedelta(minutes=budget_minutes)
    reference = completed_at or now
    elapsed_seconds = (reference - created_at).total_seconds()
    breached = reference > deadline
    remaining_seconds = None if completed_at else (deadline - now).total_seconds()
    if completed_at:
        status = "breached" if breached else "met"
    elif breached:
        status = "breached"
    elif remaining_seconds is not None and remaining_seconds < budget_minutes * 60 * 0.25:
        status = "at_risk"
    else:
        status = "on_track"
    return {
        "budget_minutes": budget_minutes,
        "deadline": deadline.isoformat(),
        "completed_at": completed_at.isoformat() if completed_at else None,
        "elapsed_seconds": round(elapsed_seconds, 1),
        "remaining_seconds": round(remaining_seconds, 1) if remaining_seconds is not None else None,
        "breached": breached,
        "status": status,
    }


def for_incident(incident: Incident, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    policy = policy_for(incident.severity)
    created = incident.created_at or now
    ack = _stage(created, incident.acknowledged_at, policy["ack_minutes"], now)
    resolve = _stage(created, incident.resolved_at, policy["resolve_minutes"], now)
    return {
        "incident_id": incident.id,
        "severity": incident.severity,
        "policy": policy,
        "acknowledge": ack,
        "resolve": resolve,
        "within_sla": not (ack["breached"] or resolve["breached"]),
    }


def overview(db: Session) -> dict:
    now = datetime.utcnow()
    incidents = db.query(Incident).all()
    rows = []
    within = 0
    ack_breaches = 0
    resolve_breaches = 0
    for incident in incidents:
        sla = for_incident(incident, now)
        rows.append({
            "incident_id": incident.id,
            "title": incident.title,
            "service_name": incident.service_name,
            "severity": incident.severity,
            "status": incident.status,
            "within_sla": sla["within_sla"],
            "acknowledge": sla["acknowledge"],
            "resolve": sla["resolve"],
        })
        if sla["within_sla"]:
            within += 1
        if sla["acknowledge"]["breached"]:
            ack_breaches += 1
        if sla["resolve"]["breached"]:
            resolve_breaches += 1
    total = len(incidents)
    compliance = (within / total) if total else 1.0
    SLA_COMPLIANCE.set(compliance)
    return {
        "total_incidents": total,
        "within_sla": within,
        "ack_breaches": ack_breaches,
        "resolve_breaches": resolve_breaches,
        "compliance_ratio": round(compliance, 3),
        "policies": {sev: policy_for(sev) for sev in ("critical", "high", "medium", "low")},
        "incidents": rows,
    }


def record_breach(stage: str, severity: str) -> None:
    SLA_BREACHES.labels(stage=stage, severity=severity).inc()
