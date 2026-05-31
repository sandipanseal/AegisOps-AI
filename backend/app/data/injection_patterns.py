"""Prompt-injection signatures scanned in logs/evidence before LLM synthesis (feature 7).

Log lines flow into the RCA prompt, so an attacker who can write to logs could try
to hijack the model. Each pattern is a case-insensitive regex with a severity.
"""
from __future__ import annotations

import re

# (name, severity, regex)
_RAW_PATTERNS: list[tuple[str, str, str]] = [
    ("ignore_previous_instructions", "high", r"ignore\s+(all\s+)?(your\s+)?(previous|prior|above)\s+instructions"),
    ("disregard_instructions", "high", r"disregard\s+(all\s+)?(previous|prior|the above)"),
    ("override_system_prompt", "high", r"(override|bypass|forget)\s+(the\s+)?(system\s+prompt|your\s+rules|all\s+rules)"),
    ("role_reassignment", "medium", r"you\s+are\s+now\s+(a|an|the)\b"),
    ("new_instructions", "medium", r"new\s+instructions?\s*:"),
    ("reveal_system_prompt", "high", r"(reveal|print|repeat|show)\s+(your\s+)?(system\s+prompt|instructions|initial\s+prompt)"),
    ("act_as_dan", "high", r"\b(do anything now|\bDAN\b|developer mode)\b"),
    ("exfiltrate_secrets", "critical", r"(print|reveal|leak|exfiltrate|send)\s+(the\s+)?(api[_\s-]?key|secret|password|token|credentials)"),
    ("recommend_destructive", "critical", r"(recommend|approve|execute|run)\s+.*(rm\s+-rf|drop\s+table|delete\s+all|shutdown|terminate\s+all)"),
    ("prompt_delimiter_injection", "medium", r"(```|</?(system|assistant|user)>|\[/?INST\])"),
    ("end_of_prompt", "medium", r"(end\s+of\s+prompt|<\s*/?\s*end\s*>)"),
]

PATTERNS: list[tuple[str, str, re.Pattern]] = [
    (name, severity, re.compile(rx, re.IGNORECASE)) for name, severity, rx in _RAW_PATTERNS
]
