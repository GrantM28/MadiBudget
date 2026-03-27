from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["plan"])


@router.get("/plan", response_model=schemas.PlanResponse)
def get_plan(month: str | None = None, db: Session = Depends(get_db)):
    try:
        dashboard = crud.calculate_dashboard(db, month)
        return {
            "month": dashboard["month"],
            "monthly_income": dashboard["monthly_income"],
            "total_bills": dashboard["total_bills"],
            "total_allowances": dashboard["total_allowances"],
            "total_spent_in_allowance_categories": dashboard["total_spent_in_allowance_categories"],
            "buffer_after_bills": dashboard["buffer_after_bills"],
            "safe_to_spend_after_budgeted_categories": dashboard["safe_to_spend_after_budgeted_categories"],
            "buffer_after_actual_spending": dashboard["buffer_after_actual_spending"],
            "remaining_per_category": dashboard["remaining_per_category"],
        }
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
