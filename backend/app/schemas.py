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


class RunbookApproval(BaseModel):
    incident_id: int
    runbook_name: str
    approved_by: str = "portfolio-reviewer"
    approved: bool


class EvalRequest(BaseModel):
    predicted_root_cause: str
    expected_root_cause: str


class PostmortemResponse(BaseModel):
    incident_id: int
    markdown: str
