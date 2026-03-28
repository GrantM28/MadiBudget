from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=schemas.DashboardResponse)
def get_dashboard(month: str | None = None, db: Session = Depends(get_db)):
    try:
        return crud.calculate_dashboard(db, month)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/cash-position", response_model=schemas.CashPositionRead)
def get_cash_position(db: Session = Depends(get_db)):
    return crud.get_cash_position(db)


@router.put("/cash-position", response_model=schemas.CashPositionRead)
def update_cash_position(
    payload: schemas.CashPositionUpdate,
    db: Session = Depends(get_db),
):
    return crud.update_cash_position(db, payload)
