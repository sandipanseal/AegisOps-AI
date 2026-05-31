"""Tool failure fallback simulation endpoints (feature 6)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas import ToolFaultRequest
from app.services import tool_faults

router = APIRouter(tags=["tool-faults"])


@router.get("/tools/faults")
def list_faults(db: Session = Depends(get_db)):
    return {"tools": tool_faults.list_faults(db)}


@router.post("/tools/{tool}/simulate-failure")
def simulate_failure(tool: str, payload: ToolFaultRequest | None = None, db: Session = Depends(get_db)):
    body = payload or ToolFaultRequest()
    try:
        return tool_faults.set_fault(db, tool, active=body.active, note=body.note)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tools/{tool}/reset")
def reset_fault(tool: str, db: Session = Depends(get_db)):
    try:
        return tool_faults.set_fault(db, tool, active=False, note="reset")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
