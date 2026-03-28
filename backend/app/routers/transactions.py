from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=list[schemas.TransactionRead])
def get_transactions(
    month: str | None = None,
    q: str | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
    source_type: str | None = None,
    merchant_group: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    db: Session = Depends(get_db),
):
    try:
        return crud.list_transactions(
            db,
            month=month,
            q=q,
            category_id=category_id,
            transaction_type=transaction_type,
            source_type=source_type,
            merchant_group=merchant_group,
            min_amount=min_amount,
            max_amount=max_amount,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/transactions/export")
def export_transactions(
    month: str | None = None,
    q: str | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
    source_type: str | None = None,
    merchant_group: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    db: Session = Depends(get_db),
):
    csv_text = crud.export_transactions_csv(
        db,
        month=month,
        q=q,
        category_id=category_id,
        transaction_type=transaction_type,
        source_type=source_type,
        merchant_group=merchant_group,
        min_amount=min_amount,
        max_amount=max_amount,
    )
    filename = f"madibudget-transactions-{month or 'current'}.csv"
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/transactions", response_model=schemas.TransactionRead, status_code=201)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_transaction(db, transaction)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.put("/transactions/{transaction_id}", response_model=schemas.TransactionRead)
def update_transaction(
    transaction_id: int,
    transaction: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
):
    try:
        return crud.update_transaction(db, transaction_id, transaction)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/transactions/{transaction_id}/receipt", response_model=schemas.TransactionRead)
async def upload_transaction_receipt(
    transaction_id: int,
    receipt: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        file_bytes = await receipt.read()
        record = crud.upload_transaction_receipt(
            db,
            transaction_id,
            file_bytes,
            receipt.filename or "receipt",
            receipt.content_type,
        )
        category_name = record.category.name if record.category else None
        merchant_group = crud._resolve_merchant_group(  # type: ignore[attr-defined]
            record.description,
            crud._list_active_merchant_rules(db),  # type: ignore[attr-defined]
        )
        return schemas.TransactionRead(
            id=record.id,
            description=record.description,
            amount=record.amount,
            date=record.date,
            transaction_type=record.transaction_type,
            category_id=record.category_id,
            category_name=category_name,
            merchant_group=merchant_group,
            note=record.note,
            has_receipt=bool(record.receipt_path),
            receipt_name=record.receipt_name,
            source_type="allowance",
            fixed_expense_id=None,
            fixed_expense_name=None,
            locked=False,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/transactions/{transaction_id}/receipt")
def download_transaction_receipt(transaction_id: int, db: Session = Depends(get_db)):
    try:
        path_value, filename, media_type = crud.get_transaction_receipt(db, transaction_id)
        return FileResponse(path_value, filename=filename, media_type=media_type)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/transactions/{transaction_id}/receipt", status_code=204)
def clear_transaction_receipt(transaction_id: int, db: Session = Depends(get_db)):
    try:
        crud.clear_transaction_receipt(db, transaction_id)
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_transaction(db, transaction_id)
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
