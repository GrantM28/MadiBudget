from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["bills"])


@router.get("/bills", response_model=list[schemas.BillRead])
def get_bills(db: Session = Depends(get_db)):
    return crud.list_bills(db)


@router.post("/bills", response_model=schemas.BillRead, status_code=201)
def create_bill(bill: schemas.BillCreate, db: Session = Depends(get_db)):
    return crud.create_bill(db, bill)


@router.put("/bills/{bill_id}", response_model=schemas.BillRead)
def update_bill(bill_id: int, bill: schemas.BillUpdate, db: Session = Depends(get_db)):
    try:
        return crud.update_bill(db, bill_id, bill)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/bills/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_bill(db, bill_id)
        return Response(status_code=204)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
