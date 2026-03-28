from fastapi import APIRouter, Depends, HTTPException, Response, status
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


@router.put("/categories/{category_id}", response_model=schemas.AllowanceCategoryRead)
def update_category(
    category_id: int,
    category: schemas.AllowanceCategoryUpdate,
    db: Session = Depends(get_db),
):
    try:
        return crud.update_category(db, category_id, category)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_category(db, category_id)
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
