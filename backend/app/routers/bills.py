from fastapi import APIRouter, Depends
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
