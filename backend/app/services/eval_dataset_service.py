"""RCA eval dataset manager (feature 8).

The benchmark used to iterate the hard-coded SCENARIOS. This makes the dataset a
first-class, editable collection of cases (seeded from the built-in scenarios,
extendable by hand or from human RCA feedback) that the benchmark runs against.
"""
from __future__ import annotations

import json
import re
from sqlalchemy.orm import Session

from app.database import EvalCase
from app.data.scenarios import SCENARIOS
from app.metrics import EVAL_DATASET_SIZE


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "case").lower()).strip("_")[:140] or "case"


def refresh_size_metric(db: Session) -> None:
    EVAL_DATASET_SIZE.set(db.query(EvalCase).filter(EvalCase.active.is_(True)).count())


def seed_builtin(db: Session) -> int:
    """Create one builtin case per scenario if not already present. Idempotent."""
    created = 0
    for key, scenario in SCENARIOS.items():
        exists = db.query(EvalCase).filter(EvalCase.key == key).first()
        if exists:
            continue
        db.add(EvalCase(
            key=key,
            title=scenario["title"],
            service_name=scenario["service_name"],
            severity=scenario["severity"],
            description=scenario["description"],
            expected_root_cause=scenario["expected_root_cause"],
            logs=json.dumps(scenario.get("logs", [])),
            source="builtin",
            active=True,
        ))
        created += 1
    if created:
        db.commit()
    refresh_size_metric(db)
    return created


def ensure_seeded(db: Session) -> None:
    # seed_builtin is idempotent per-key, so it's safe to call whenever the dataset
    # is read — this guarantees the builtin baseline exists even if custom/feedback
    # cases were added first (which would otherwise leave the table non-empty but
    # missing the builtins).
    seed_builtin(db)


def active_cases(db: Session) -> list[EvalCase]:
    ensure_seeded(db)
    return db.query(EvalCase).filter(EvalCase.active.is_(True)).order_by(EvalCase.id.asc()).all()


def serialize(case: EvalCase) -> dict:
    return {
        "id": case.id,
        "key": case.key,
        "title": case.title,
        "service_name": case.service_name,
        "severity": case.severity,
        "description": case.description,
        "expected_root_cause": case.expected_root_cause,
        "logs": json.loads(case.logs or "[]"),
        "source": case.source,
        "active": case.active,
        "created_at": case.created_at.isoformat() if case.created_at else None,
    }


def list_cases(db: Session, include_inactive: bool = True) -> list[dict]:
    ensure_seeded(db)
    query = db.query(EvalCase)
    if not include_inactive:
        query = query.filter(EvalCase.active.is_(True))
    return [serialize(c) for c in query.order_by(EvalCase.id.asc()).all()]


def create_case(db: Session, payload) -> dict:
    key = payload.key or _slug(payload.title)
    # de-duplicate the key
    base, n = key, 1
    while db.query(EvalCase).filter(EvalCase.key == key).first():
        n += 1
        key = f"{base}_{n}"
    severity = payload.severity.value if hasattr(payload.severity, "value") else str(payload.severity)
    case = EvalCase(
        key=key,
        title=payload.title,
        service_name=payload.service_name,
        severity=severity,
        description=payload.description,
        expected_root_cause=payload.expected_root_cause,
        logs=json.dumps(payload.logs or []),
        source=payload.source or "custom",
        active=True,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    refresh_size_metric(db)
    return serialize(case)


def update_case(db: Session, case_id: int, payload) -> dict | None:
    case = db.query(EvalCase).filter(EvalCase.id == case_id).first()
    if not case:
        return None
    if payload.title is not None:
        case.title = payload.title
    if payload.service_name is not None:
        case.service_name = payload.service_name
    if payload.severity is not None:
        case.severity = payload.severity.value if hasattr(payload.severity, "value") else str(payload.severity)
    if payload.description is not None:
        case.description = payload.description
    if payload.expected_root_cause is not None:
        case.expected_root_cause = payload.expected_root_cause
    if payload.logs is not None:
        case.logs = json.dumps(payload.logs)
    if payload.active is not None:
        case.active = payload.active
    db.commit()
    db.refresh(case)
    refresh_size_metric(db)
    return serialize(case)


def delete_case(db: Session, case_id: int) -> bool:
    case = db.query(EvalCase).filter(EvalCase.id == case_id).first()
    if not case:
        return False
    db.delete(case)
    db.commit()
    refresh_size_metric(db)
    return True


def create_from_feedback(db: Session, incident, corrected_root_cause: str, logs: list[str] | None = None) -> dict:
    """Promote a human-corrected root cause into a new eval case."""
    key = _slug(f"feedback_{incident.service_name}_{incident.id}")
    base, n = key, 1
    while db.query(EvalCase).filter(EvalCase.key == key).first():
        n += 1
        key = f"{base}_{n}"
    case = EvalCase(
        key=key,
        title=f"[feedback] {incident.title}",
        service_name=incident.service_name,
        severity=incident.severity,
        description=incident.description,
        expected_root_cause=corrected_root_cause,
        logs=json.dumps(logs or []),
        source="human_feedback",
        active=True,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    refresh_size_metric(db)
    return serialize(case)
