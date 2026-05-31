"""SLA policies by severity (feature 2).

Targets are in minutes: time to acknowledge and time to resolve from incident
open. Used to compute remaining budget, breach state, and compliance.
"""
from __future__ import annotations

# severity -> {"ack_minutes", "resolve_minutes"}
SLA_POLICIES: dict[str, dict[str, int]] = {
    "critical": {"ack_minutes": 5, "resolve_minutes": 60},
    "high": {"ack_minutes": 15, "resolve_minutes": 240},
    "medium": {"ack_minutes": 30, "resolve_minutes": 480},
    "low": {"ack_minutes": 60, "resolve_minutes": 1440},
}

DEFAULT_POLICY = {"ack_minutes": 30, "resolve_minutes": 480}


def policy_for(severity: str) -> dict[str, int]:
    return SLA_POLICIES.get((severity or "").lower(), DEFAULT_POLICY)
