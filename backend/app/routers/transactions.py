from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=list[schemas.TransactionRead])
def get_transactions(month: str | None = None, db: Session = Depends(get_db)):
    try:
        return crud.list_transactions(db, month)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/transactions", response_model=schemas.TransactionRead, status_code=201)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_transaction(db, transaction)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
