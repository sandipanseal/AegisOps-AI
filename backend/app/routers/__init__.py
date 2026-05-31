"""Feature routers for AegisOps AI.

Each module exposes a ``router`` (APIRouter). ``ALL_ROUTERS`` is the ordered list
the app mounts in ``app.main``.
"""
from app.routers import (
    lifecycle,
    sla,
    confidence,
    runbooks_risk,
    feedback,
    tools_fault,
    injection,
    eval_dataset,
    canary,
    dependency_graph,
)

ALL_ROUTERS = [
    lifecycle.router,
    sla.router,
    confidence.router,
    runbooks_risk.router,
    feedback.router,
    tools_fault.router,
    injection.router,
    eval_dataset.router,
    canary.router,
    dependency_graph.router,
]
