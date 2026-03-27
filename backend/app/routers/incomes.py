from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["incomes"])


@router.get("/incomes", response_model=list[schemas.IncomeSourceRead])
def get_incomes(db: Session = Depends(get_db)):
    return crud.list_incomes(db)


@router.post("/incomes", response_model=schemas.IncomeSourceRead, status_code=201)
def create_income(income: schemas.IncomeSourceCreate, db: Session = Depends(get_db)):
    return crud.create_income(db, income)
