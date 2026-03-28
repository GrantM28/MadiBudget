from fastapi import APIRouter, Depends, HTTPException, Response, status
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


@router.put("/incomes/{income_id}", response_model=schemas.IncomeSourceRead)
def update_income(income_id: int, income: schemas.IncomeSourceUpdate, db: Session = Depends(get_db)):
    try:
        return crud.update_income(db, income_id, income)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/incomes/{income_id}", status_code=204)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_income(db, income_id)
        return Response(status_code=204)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/income-adjustments", response_model=list[schemas.VariableIncomeRead])
def get_income_adjustments(month: str | None = None, db: Session = Depends(get_db)):
    try:
        return crud.list_variable_income_entries(db, month)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/income-adjustments", response_model=schemas.VariableIncomeRead, status_code=201)
def create_income_adjustment(
    entry: schemas.VariableIncomeCreate,
    db: Session = Depends(get_db),
):
    return crud.create_variable_income_entry(db, entry)


@router.put("/income-adjustments/{entry_id}", response_model=schemas.VariableIncomeRead)
def update_income_adjustment(
    entry_id: int,
    entry: schemas.VariableIncomeUpdate,
    db: Session = Depends(get_db),
):
    try:
        return crud.update_variable_income_entry(db, entry_id, entry)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/income-adjustments/{entry_id}", status_code=204)
def delete_income_adjustment(entry_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_variable_income_entry(db, entry_id)
        return Response(status_code=204)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
