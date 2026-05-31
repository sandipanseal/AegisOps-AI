"""Runbook risk scoring endpoints (feature 4)."""
from fastapi import APIRouter, HTTPException

from app.services.runbook_executor import RunbookExecutor
from app.services import runbook_risk_service

router = APIRouter(tags=["runbook-risk"])

_executor = RunbookExecutor()


@router.get("/runbooks/risk")
def runbooks_risk():
    scored = []
    for runbook in _executor.list_runbooks():
        assessment = runbook_risk_service.score_runbook(runbook)
        assessment["key"] = runbook.get("key")
        assessment["description"] = runbook.get("description")
        scored.append(assessment)
    scored.sort(key=lambda x: x["risk_score"], reverse=True)
    return scored


@router.get("/runbooks/{runbook_name}/risk")
def runbook_risk(runbook_name: str):
    try:
        runbook = _executor.load(runbook_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    runbook.setdefault("key", runbook_name)
    return runbook_risk_service.score_runbook(runbook)
