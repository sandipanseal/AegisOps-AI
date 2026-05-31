"""RCA eval dataset manager endpoints (feature 8)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas import EvalCaseCreate, EvalCaseUpdate
from app.services import eval_dataset_service

router = APIRouter(tags=["eval-dataset"])


@router.get("/evals/dataset")
def list_dataset(include_inactive: bool = True, db: Session = Depends(get_db)):
    return eval_dataset_service.list_cases(db, include_inactive=include_inactive)


@router.post("/evals/dataset")
def create_case(payload: EvalCaseCreate, db: Session = Depends(get_db)):
    return eval_dataset_service.create_case(db, payload)


@router.patch("/evals/dataset/{case_id}")
def update_case(case_id: int, payload: EvalCaseUpdate, db: Session = Depends(get_db)):
    updated = eval_dataset_service.update_case(db, case_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Eval case not found")
    return updated


@router.delete("/evals/dataset/{case_id}")
def delete_case(case_id: int, db: Session = Depends(get_db)):
    if not eval_dataset_service.delete_case(db, case_id):
        raise HTTPException(status_code=404, detail="Eval case not found")
    return {"status": "deleted", "id": case_id}


@router.post("/evals/dataset/seed")
def seed_dataset(db: Session = Depends(get_db)):
    created = eval_dataset_service.seed_builtin(db)
    return {"seeded": created, "total_active": len(eval_dataset_service.list_cases(db, include_inactive=False))}
