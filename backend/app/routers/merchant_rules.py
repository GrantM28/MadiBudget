from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["merchant-rules"])


@router.get("/merchant-rules", response_model=list[schemas.MerchantRuleRead])
def get_merchant_rules(db: Session = Depends(get_db)):
    return crud.list_merchant_rules(db)


@router.post("/merchant-rules", response_model=schemas.MerchantRuleRead, status_code=201)
def create_merchant_rule(payload: schemas.MerchantRuleCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_merchant_rule(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.put("/merchant-rules/{rule_id}", response_model=schemas.MerchantRuleRead)
def update_merchant_rule(
    rule_id: int,
    payload: schemas.MerchantRuleUpdate,
    db: Session = Depends(get_db),
):
    try:
        return crud.update_merchant_rule(db, rule_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/merchant-rules/{rule_id}", status_code=204)
def delete_merchant_rule(rule_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_merchant_rule(db, rule_id)
        return Response(status_code=204)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
