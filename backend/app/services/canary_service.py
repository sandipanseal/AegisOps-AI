"""Canary deployment analysis (feature 9).

Compares a canary's golden signals against a baseline and returns an automated
promote / hold / rollback verdict with the reasons behind it. Metrics can be
supplied explicitly, or derived from live service signals (canary) versus a known
healthy baseline.
"""
from __future__ import annotations

import json
from sqlalchemy.orm import Session

from app.database import CanaryAnalysis
from app.data.scenarios import SCENARIOS
from app.metrics import CANARY_ANALYSES
from app.services.service_client import ServiceClient

HEALTHY_BASELINE = {"p95_latency_ms": 120.0, "error_rate_pct": 0.4, "cpu_pct": 22.0, "memory_pct": 34.0}


def _metrics_for(service_name: str) -> dict:
    """Best-effort live canary metrics, falling back to a scenario fixture."""
    live = ServiceClient().get(service_name, "/signals")
    if live and live.get("metrics"):
        return {**HEALTHY_BASELINE, **live["metrics"]}
    for scenario in SCENARIOS.values():
        if scenario["service_name"] == service_name:
            return {**HEALTHY_BASELINE, **scenario["metrics"]}
    return dict(HEALTHY_BASELINE)


def _pct_delta(canary: float, baseline: float) -> float:
    if baseline <= 0:
        return canary
    return (canary - baseline) / baseline


def analyze(db: Session, service_name: str, baseline: dict | None, canary: dict | None, incident_id: int | None = None) -> dict:
    baseline = {**HEALTHY_BASELINE, **(baseline or {})}
    canary = canary or _metrics_for(service_name)
    canary = {**HEALTHY_BASELINE, **canary}

    penalties = 0
    reasons: list[dict] = []
    severe = False

    latency_delta = _pct_delta(canary["p95_latency_ms"], baseline["p95_latency_ms"])
    if latency_delta > 0.5:
        penalties += 40
        severe = True
        reasons.append({"signal": "p95_latency", "verdict": "regression", "detail": f"p95 latency up {latency_delta * 100:.0f}% ({baseline['p95_latency_ms']:.0f}→{canary['p95_latency_ms']:.0f}ms)"})
    elif latency_delta > 0.2:
        penalties += 20
        reasons.append({"signal": "p95_latency", "verdict": "warn", "detail": f"p95 latency up {latency_delta * 100:.0f}%"})
    else:
        reasons.append({"signal": "p95_latency", "verdict": "ok", "detail": f"p95 latency within {latency_delta * 100:.0f}% of baseline"})

    error_delta = canary["error_rate_pct"] - baseline["error_rate_pct"]
    if error_delta > 5:
        penalties += 40
        severe = True
        reasons.append({"signal": "error_rate", "verdict": "regression", "detail": f"error rate up {error_delta:.1f}pp ({baseline['error_rate_pct']:.1f}%→{canary['error_rate_pct']:.1f}%)"})
    elif error_delta > 1:
        penalties += 20
        reasons.append({"signal": "error_rate", "verdict": "warn", "detail": f"error rate up {error_delta:.1f}pp"})
    else:
        reasons.append({"signal": "error_rate", "verdict": "ok", "detail": f"error rate delta {error_delta:.1f}pp"})

    mem_delta = canary["memory_pct"] - baseline["memory_pct"]
    if mem_delta > 20:
        penalties += 15
        reasons.append({"signal": "memory", "verdict": "warn", "detail": f"memory up {mem_delta:.0f}pp"})
    elif mem_delta > 10:
        penalties += 8
        reasons.append({"signal": "memory", "verdict": "warn", "detail": f"memory up {mem_delta:.0f}pp"})

    score = max(0, 100 - penalties)
    if severe or score < 50:
        verdict = "rollback"
    elif score < 80:
        verdict = "hold"
    else:
        verdict = "promote"

    CANARY_ANALYSES.labels(verdict=verdict).inc()
    row = CanaryAnalysis(
        incident_id=incident_id,
        service_name=service_name,
        verdict=verdict,
        score=score,
        baseline=json.dumps(baseline),
        canary=json.dumps(canary),
        reasons=json.dumps(reasons),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "service_name": service_name,
        "verdict": verdict,
        "score": score,
        "baseline": baseline,
        "canary": canary,
        "reasons": reasons,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_analyses(db: Session, limit: int = 20) -> list[dict]:
    rows = db.query(CanaryAnalysis).order_by(CanaryAnalysis.id.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "incident_id": r.incident_id,
            "service_name": r.service_name,
            "verdict": r.verdict,
            "score": r.score,
            "baseline": json.loads(r.baseline),
            "canary": json.loads(r.canary),
            "reasons": json.loads(r.reasons),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
