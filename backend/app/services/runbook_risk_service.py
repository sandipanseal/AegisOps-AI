"""Runbook risk scoring (feature 4).

Turns a runbook's declared risk attributes into a 0-100 score and a factor
breakdown, so reviewers see *why* a remediation is risky before approving it.
"""
from __future__ import annotations

from app.metrics import RUNBOOK_RISK_SCORE

_RISK_LEVEL = {"high": 40, "medium": 25, "low": 10}
_BLAST_RADIUS = {"high": 25, "medium": 15, "low": 5}
# Lower reversibility => higher risk.
_REVERSIBILITY = {"low": 20, "medium": 12, "high": 5}
_DATA_LOSS = {"high": 20, "medium": 12, "low": 3}


def _factor(label: str, value: str, table: dict, default: int) -> dict:
    points = table.get((value or "").lower(), default)
    return {"label": label, "value": value or "unknown", "points": points}


def score_runbook(runbook: dict) -> dict:
    factors = [
        _factor("Declared risk level", runbook.get("risk_level", "unknown"), _RISK_LEVEL, 25),
        _factor("Blast radius", runbook.get("blast_radius", "medium"), _BLAST_RADIUS, 15),
        _factor("Reversibility", runbook.get("reversibility", "medium"), _REVERSIBILITY, 12),
        _factor("Data-loss risk", runbook.get("data_loss_risk", "low"), _DATA_LOSS, 3),
    ]
    score = min(100, sum(f["points"] for f in factors))
    band = "high" if score >= 60 else "medium" if score >= 30 else "low"
    name = runbook.get("name") or runbook.get("key") or "unknown"
    RUNBOOK_RISK_SCORE.labels(runbook=name).set(score)
    return {
        "runbook": name,
        "risk_score": score,
        "risk_band": band,
        "requires_approval": bool(runbook.get("requires_approval", True)) or band != "low",
        "recovery_minutes": runbook.get("recovery_minutes"),
        "factors": factors,
    }
