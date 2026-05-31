"""Service dependency graph + impact analysis endpoints (feature 10)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db
from app.database import Incident
from app.data import service_graph
from app.metrics import DEPENDENCY_IMPACT

router = APIRouter(tags=["dependency-graph"])

_ACTIVE_STATUSES = {"open", "acknowledged", "investigating", "identified", "mitigating"}


def _active_incident_index(db: Session) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = {}
    for inc in db.query(Incident).all():
        if inc.status in _ACTIVE_STATUSES:
            index.setdefault(inc.service_name, []).append({"id": inc.id, "title": inc.title, "severity": inc.severity, "status": inc.status})
    return index


@router.get("/services/dependency-graph")
def dependency_graph(db: Session = Depends(get_db)):
    incidents = _active_incident_index(db)
    nodes = []
    for name in service_graph.all_nodes():
        meta = service_graph.NODE_META.get(name, {"tier": "unknown", "kind": "service", "criticality": "medium"})
        active = incidents.get(name, [])
        nodes.append({
            "name": name,
            **meta,
            "depends_on": service_graph.dependencies_of(name),
            "depended_on_by": service_graph.dependents_of(name),
            "active_incidents": active,
            "health": "degraded" if active else "healthy",
        })
    return {"nodes": nodes, "edges": service_graph.edges()}


@router.get("/services/{service_name}/dependencies")
def service_dependencies(service_name: str):
    return {
        "service": service_name,
        "direct_dependencies": service_graph.dependencies_of(service_name),
        "transitive_dependencies": service_graph.downstream_closure(service_name),
        "direct_dependents": service_graph.dependents_of(service_name),
    }


@router.get("/services/{service_name}/impact")
def service_impact(service_name: str, db: Session = Depends(get_db)):
    impacted = service_graph.upstream_closure(service_name)
    DEPENDENCY_IMPACT.labels(service=service_name).set(len(impacted))
    incidents = _active_incident_index(db)
    return {
        "service": service_name,
        "blast_radius": len(impacted),
        "impacted_services": impacted,
        "direct_dependents": service_graph.dependents_of(service_name),
        "depends_on": service_graph.dependencies_of(service_name),
        "impacted_with_active_incidents": [s for s in impacted if s in incidents],
    }
