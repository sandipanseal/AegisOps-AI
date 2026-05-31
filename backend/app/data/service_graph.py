"""Static service dependency graph for AegisOps AI (feature 10).

Each entry lists the services/infra a node *depends on* (calls downstream). The
graph powers dependency visualisation and blast-radius / impact analysis: if a
node degrades, every node that (transitively) depends on it is impacted.
"""
from __future__ import annotations

# node -> list of dependencies (things this node calls / needs to function)
DEPENDENCIES: dict[str, list[str]] = {
    "checkout-service": ["payment-service", "auth-service", "inventory-service"],
    "payment-service": ["auth-service", "payments-db"],
    "recommendation-service": ["auth-service", "feature-store"],
    "auth-service": ["auth-db"],
    "inventory-service": ["inventory-db"],
    # leaf infrastructure nodes
    "payments-db": [],
    "auth-db": [],
    "inventory-db": [],
    "feature-store": [],
}

# Presentation metadata for each node.
NODE_META: dict[str, dict] = {
    "checkout-service": {"tier": "edge", "kind": "service", "criticality": "high"},
    "payment-service": {"tier": "core", "kind": "service", "criticality": "critical"},
    "auth-service": {"tier": "core", "kind": "service", "criticality": "critical"},
    "recommendation-service": {"tier": "edge", "kind": "service", "criticality": "medium"},
    "inventory-service": {"tier": "core", "kind": "service", "criticality": "high"},
    "payments-db": {"tier": "data", "kind": "datastore", "criticality": "critical"},
    "auth-db": {"tier": "data", "kind": "datastore", "criticality": "critical"},
    "inventory-db": {"tier": "data", "kind": "datastore", "criticality": "high"},
    "feature-store": {"tier": "data", "kind": "datastore", "criticality": "medium"},
}


def all_nodes() -> list[str]:
    nodes = set(DEPENDENCIES)
    for deps in DEPENDENCIES.values():
        nodes.update(deps)
    return sorted(nodes)


def dependencies_of(service: str) -> list[str]:
    """Direct downstream dependencies of a service."""
    return list(DEPENDENCIES.get(service, []))


def dependents_of(service: str) -> list[str]:
    """Direct upstream callers that depend on this service."""
    return sorted([node for node, deps in DEPENDENCIES.items() if service in deps])


def _transitive(service: str, edges: dict[str, list[str]]) -> list[str]:
    seen: set[str] = set()
    stack = list(edges.get(service, []))
    while stack:
        node = stack.pop()
        if node in seen or node == service:
            continue
        seen.add(node)
        stack.extend(edges.get(node, []))
    return sorted(seen)


def downstream_closure(service: str) -> list[str]:
    """All services this one transitively depends on."""
    return _transitive(service, DEPENDENCIES)


def upstream_closure(service: str) -> list[str]:
    """All services transitively impacted if this one fails (blast radius)."""
    reverse: dict[str, list[str]] = {}
    for node, deps in DEPENDENCIES.items():
        for dep in deps:
            reverse.setdefault(dep, []).append(node)
    return _transitive(service, reverse)


def edges() -> list[dict]:
    return [
        {"source": node, "target": dep}
        for node, deps in DEPENDENCIES.items()
        for dep in deps
    ]
