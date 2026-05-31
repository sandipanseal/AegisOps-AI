"""AI confidence explanation (feature 3).

Turns the RCA confidence score from an opaque number into an auditable breakdown:
which factors raised or lowered confidence, and by how much. The same routine
produces the final score so the number and its explanation never disagree.
"""
from __future__ import annotations

KNOWN_SOURCES = {"logs", "metrics", "kubernetes", "deployment_history", "rag_memory"}


def _metric_signal_strength(evidence) -> tuple[float, str]:
    """Stronger anomalies in the metrics evidence => more confident RCA."""
    for item in evidence:
        if getattr(item, "source", "") != "metrics":
            continue
        details = getattr(item, "details", {}) or {}
        error_rate = float(details.get("error_rate_pct", 0) or 0)
        latency = float(details.get("p95_latency_ms", 0) or 0)
        memory = float(details.get("memory_pct", 0) or 0)
        score = 0.0
        if error_rate >= 10:
            score += 0.06
        elif error_rate >= 3:
            score += 0.03
        if latency >= 1500:
            score += 0.04
        elif latency >= 800:
            score += 0.02
        if memory >= 90:
            score += 0.02
        detail = f"error_rate={error_rate}% p95={latency}ms memory={memory}%"
        return min(score, 0.12), detail
    return 0.0, "no metrics evidence"


def assess(incident, evidence: list, used_llm: bool) -> dict:
    """Return {"score": float, "summary": str, "factors": [...]}."""
    factors: list[dict] = []
    severity = (getattr(incident, "severity", "") or "medium").lower()

    base = {"critical": 0.58, "high": 0.56, "medium": 0.52, "low": 0.48}.get(severity, 0.52)
    score = base
    factors.append({
        "label": "Severity baseline",
        "delta": round(base, 3),
        "detail": f"Baseline for a {severity} incident.",
    })

    distinct = {getattr(e, "source", "") for e in evidence} & KNOWN_SOURCES
    diversity_delta = round(min(len(distinct), 5) * 0.05, 3)
    score += diversity_delta
    factors.append({
        "label": "Evidence coverage",
        "delta": diversity_delta,
        "detail": f"{len(distinct)} independent evidence source(s): {', '.join(sorted(distinct)) or 'none'}.",
    })

    signal_delta, signal_detail = _metric_signal_strength(evidence)
    if signal_delta:
        score += signal_delta
        factors.append({
            "label": "Signal strength",
            "delta": round(signal_delta, 3),
            "detail": f"Clear anomaly in metrics ({signal_detail}).",
        })

    rag_matches = 0
    for e in evidence:
        if getattr(e, "source", "") == "rag_memory":
            rag_matches = len((getattr(e, "details", {}) or {}).get("matches", []) or [])
    if rag_matches:
        delta = 0.06
        score += delta
        factors.append({
            "label": "Historical precedent",
            "delta": delta,
            "detail": f"{rag_matches} similar past incident(s)/runbook(s) retrieved from memory.",
        })

    if used_llm:
        delta = 0.08
        score += delta
        factors.append({
            "label": "LLM synthesis",
            "delta": delta,
            "detail": "Root cause synthesized by the configured LLM gateway/model.",
        })
    else:
        delta = -0.04
        score += delta
        factors.append({
            "label": "Deterministic fallback",
            "delta": delta,
            "detail": "No live model available — used the deterministic fallback synthesizer.",
        })

    score = round(max(0.4, min(score, 0.95)), 2)
    top = max(factors, key=lambda f: abs(f["delta"]))
    summary = (
        f"Confidence {int(score * 100)}% — driven mainly by '{top['label']}'. "
        f"{len(distinct)} evidence source(s), "
        f"{'LLM-synthesized' if used_llm else 'deterministic'} root cause."
    )
    return {"score": score, "summary": summary, "factors": factors}
