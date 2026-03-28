from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..db import get_db


router = APIRouter(tags=["bills"])


@router.get("/bills", response_model=list[schemas.BillRead])
def get_bills(month: str | None = None, db: Session = Depends(get_db)):
    try:
        return crud.list_bills(db, month)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("/bills/export")
def export_bills(month: str | None = None, db: Session = Depends(get_db)):
    csv_text = crud.export_fixed_expenses_csv(db, month)
    filename = f"madibudget-fixed-expenses-{month or 'current'}.csv"
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.put("/bills/{bill_id}/payment", response_model=schemas.BillRead)
def set_bill_payment(
    bill_id: int,
    payment: schemas.BillPaymentUpdate,
    db: Session = Depends(get_db),
):
    try:
        return crud.set_bill_payment(db, bill_id, payment)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/bills/{bill_id}/payment", status_code=204)
def clear_bill_payment(bill_id: int, month: str, db: Session = Depends(get_db)):
    try:
        crud.clear_bill_payment(db, bill_id, month)
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/bills/{bill_id}/payment/receipt", status_code=204)
async def upload_bill_payment_receipt(
    bill_id: int,
    month: str,
    receipt: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        file_bytes = await receipt.read()
        crud.upload_bill_payment_receipt(
            db,
            bill_id,
            month,
            file_bytes,
            receipt.filename or "receipt",
            receipt.content_type,
        )
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/bills/{bill_id}/payment/receipt")
def download_bill_payment_receipt(bill_id: int, month: str, db: Session = Depends(get_db)):
    try:
        path_value, filename, media_type = crud.get_bill_payment_receipt(db, bill_id, month)
        return FileResponse(path_value, filename=filename, media_type=media_type)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/bills/{bill_id}/payment/receipt", status_code=204)
def clear_bill_payment_receipt(bill_id: int, month: str, db: Session = Depends(get_db)):
    try:
        crud.clear_bill_payment_receipt(db, bill_id, month)
        return Response(status_code=204)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
