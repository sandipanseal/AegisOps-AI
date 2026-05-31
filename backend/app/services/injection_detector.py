"""Prompt-injection detection in logs (feature 7).

Log lines are fed into the RCA prompt, so a malicious log line is an injection
vector. This scanner flags suspicious lines against known signatures and can
sanitize them before they reach the model.
"""
from __future__ import annotations

from app.data.injection_patterns import PATTERNS

_SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def scan(lines: list[str], source: str = "logs") -> list[dict]:
    """Return one detection per (line, matched pattern)."""
    detections: list[dict] = []
    for line in lines or []:
        if not isinstance(line, str):
            continue
        for name, severity, pattern in PATTERNS:
            if pattern.search(line):
                detections.append({
                    "source": source,
                    "line": line[:500],
                    "pattern": name,
                    "severity": severity,
                })
    return detections


def highest_severity(detections: list[dict]) -> str | None:
    if not detections:
        return None
    return max(detections, key=lambda d: _SEVERITY_RANK.get(d["severity"], 0))["severity"]


def sanitize(lines: list[str], source: str = "logs") -> tuple[list[str], list[dict]]:
    """Return (clean_lines, detections); flagged lines are redacted, not dropped."""
    detections = scan(lines, source=source)
    flagged = {d["line"] for d in detections}
    clean: list[str] = []
    for line in lines or []:
        if isinstance(line, str) and line[:500] in flagged:
            clean.append("[REDACTED: possible prompt injection] " + line[:120])
        else:
            clean.append(line)
    return clean, detections
