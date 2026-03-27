from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[schemas.AllowanceCategoryRead])
def get_categories(db: Session = Depends(get_db)):
    return crud.list_categories(db)


@router.post("/categories", response_model=schemas.AllowanceCategoryRead, status_code=201)
def create_category(category: schemas.AllowanceCategoryCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_category(db, category)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
