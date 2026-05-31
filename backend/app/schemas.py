from enum import Enum
from typing import Any
from pydantic import BaseModel


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentCreate(BaseModel):
    title: str
    description: str
    service_name: str
    severity: Severity = Severity.medium
    scenario_key: str = "custom"


class Evidence(BaseModel):
    source: str
    summary: str
    details: dict[str, Any] = {}


class RCAResult(BaseModel):
    incident_id: int
    suspected_root_cause: str
    confidence_score: float
    evidence: list[Evidence]
    recommended_actions: list[str]
    risky_actions: list[str]
    requires_human_approval: bool
    confidence_explanation: dict[str, Any] | None = None


class RunbookApproval(BaseModel):
    incident_id: int
    runbook_name: str
    approved_by: str = "sre-oncall"
    approved: bool


class EvalRequest(BaseModel):
    predicted_root_cause: str
    expected_root_cause: str


class PostmortemResponse(BaseModel):
    incident_id: int
    markdown: str


# 1. Incident lifecycle workflow
class IncidentTransition(BaseModel):
    to_status: str
    actor: str = "sre-oncall"
    note: str | None = None


class IncidentAssign(BaseModel):
    assignee: str
    actor: str = "sre-oncall"


# 5. Human RCA feedback
class RCAFeedbackCreate(BaseModel):
    verdict: str  # accurate | partially_accurate | inaccurate
    rating: int | None = None  # 1-5
    corrected_root_cause: str | None = None
    comment: str | None = None
    reviewer: str = "sre-oncall"
    promote_to_eval: bool = True


# 8. RCA eval dataset manager
class EvalCaseCreate(BaseModel):
    key: str | None = None
    title: str
    service_name: str
    severity: Severity = Severity.medium
    description: str = ""
    expected_root_cause: str
    logs: list[str] = []
    source: str = "custom"


class EvalCaseUpdate(BaseModel):
    title: str | None = None
    service_name: str | None = None
    severity: Severity | None = None
    description: str | None = None
    expected_root_cause: str | None = None
    logs: list[str] | None = None
    active: bool | None = None


# 9. Canary deployment analysis
class CanaryMetrics(BaseModel):
    p95_latency_ms: float
    error_rate_pct: float
    cpu_pct: float = 0.0
    memory_pct: float = 0.0


class CanaryRequest(BaseModel):
    service_name: str
    incident_id: int | None = None
    baseline: CanaryMetrics | None = None
    canary: CanaryMetrics | None = None


# 6. Tool failure fallback simulation
class ToolFaultRequest(BaseModel):
    active: bool = True
    note: str | None = None


# 7. Prompt-injection detection
class InjectionScanRequest(BaseModel):
    lines: list[str]
    source: str = "manual"
    incident_id: int | None = None
