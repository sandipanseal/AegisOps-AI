"""Tool failure fallback simulation (feature 6).

A small registry of "broken" tools. Integration clients (Loki, Kubernetes,
service HTTP, InferOps, RAG) consult :func:`is_active` on every call; when a tool
is marked failing they short-circuit to their degraded fallback path, exercising
the platform's graceful-degradation behaviour on demand.

State is mirrored into an in-process set so hot-path clients don't need a DB
session, and persisted in ``tool_fault_injections`` so it survives across requests.
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy.orm import Session

from app.database import ToolFaultInjection
from app.metrics import TOOL_FAULTS_INJECTED, TOOL_FALLBACKS, TOOL_FAILURES

# Tools whose failure modes can be simulated, with the fallback they trigger.
SUPPORTED_TOOLS: dict[str, str] = {
    "loki": "LogAnalysisAgent falls back to live service logs, then scenario fixtures.",
    "kubernetes": "KubernetesStateAgent falls back to service-reported pod state, then fixtures.",
    "service": "Evidence agents fall back to scenario fixtures when service HTTP fails.",
    "inferops": "RCA synthesis falls back to direct OpenAI, then the deterministic synthesizer.",
    "rag": "RagMemoryAgent returns no historical matches.",
}

_ACTIVE: set[str] = set()


def is_active(tool: str) -> bool:
    return tool in _ACTIVE


def record_fallback(tool: str) -> None:
    """Called by a client when a simulated fault forced it onto its fallback path."""
    TOOL_FALLBACKS.labels(tool=tool).inc()
    TOOL_FAILURES.labels(tool=f"simulated:{tool}").inc()


def load_from_db(db: Session) -> None:
    """Rehydrate the in-process active set from persisted state (called at startup)."""
    _ACTIVE.clear()
    for row in db.query(ToolFaultInjection).filter(ToolFaultInjection.active.is_(True)).all():
        if row.tool in SUPPORTED_TOOLS:
            _ACTIVE.add(row.tool)


def set_fault(db: Session, tool: str, active: bool, note: str | None = None) -> dict:
    if tool not in SUPPORTED_TOOLS:
        raise ValueError(f"Unknown tool '{tool}'. Supported: {', '.join(sorted(SUPPORTED_TOOLS))}")
    row = db.query(ToolFaultInjection).filter(ToolFaultInjection.tool == tool).first()
    if row is None:
        row = ToolFaultInjection(tool=tool, active=active, note=note)
        db.add(row)
    else:
        row.active = active
        row.note = note
        row.updated_at = datetime.utcnow()
    db.commit()
    if active:
        _ACTIVE.add(tool)
    else:
        _ACTIVE.discard(tool)
    TOOL_FAULTS_INJECTED.labels(tool=tool, active=str(active).lower()).inc()
    return state(tool)


def state(tool: str) -> dict:
    return {
        "tool": tool,
        "active": tool in _ACTIVE,
        "fallback": SUPPORTED_TOOLS.get(tool, "unknown tool"),
    }


def list_faults(db: Session | None = None) -> list[dict]:
    return [state(tool) for tool in sorted(SUPPORTED_TOOLS)]
