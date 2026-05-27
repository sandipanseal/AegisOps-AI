from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, Enum):
    open = "open"
    analyzed = "analyzed"
    action_pending = "action_pending"
    resolved = "resolved"


class IncidentCreate(BaseModel):
    title: str = Field(..., examples=["Payment API latency spike"])
    description: str = Field(..., examples=["Payment service latency increased by 400% after latest deployment."])
    service_name: str = Field(..., examples=["payment-service"])
    severity: Severity = Severity.high


class IncidentOut(BaseModel):
    id: int
    title: str
    description: str
    service_name: str
    severity: str
    status: str


class Evidence(BaseModel):
    source: str
    summary: str
    details: dict[str, Any] = Field(default_factory=dict)


class RCAResult(BaseModel):
    incident_id: int
    suspected_root_cause: str
    confidence_score: float
    evidence: list[Evidence]
    recommended_actions: list[str]
    risky_actions: list[str]
    requires_human_approval: bool


class RunbookApproval(BaseModel):
    incident_id: int
    runbook_name: str
    approved_by: str
    approved: bool


class EvalRequest(BaseModel):
    predicted_root_cause: str
    expected_root_cause: str
