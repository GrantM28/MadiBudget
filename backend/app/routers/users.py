from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..db import get_db


router = APIRouter(tags=["users"])


@router.get("/users", response_model=list[schemas.UserRead])
def get_users(
    owner: models.User = Depends(auth.require_owner),
    db: Session = Depends(get_db),
):
    return crud.list_users(db)


@router.post("/users", response_model=schemas.UserRead, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    owner: models.User = Depends(auth.require_owner),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_user(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.put("/users/{user_id}", response_model=schemas.UserRead)
def update_user(
    user_id: int,
    payload: schemas.UserAdminUpdate,
    owner: models.User = Depends(auth.require_owner),
    db: Session = Depends(get_db),
):
    try:
        return crud.update_user_admin(db, user_id, payload, owner.id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/users/{user_id}/reset-password", status_code=204)
def reset_user_password(
    user_id: int,
    payload: schemas.AdminPasswordResetRequest,
    owner: models.User = Depends(auth.require_owner),
    db: Session = Depends(get_db),
):
    try:
        crud.admin_reset_user_password(db, user_id, payload.new_password)
        return Response(status_code=204)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/users/me/avatar", response_model=schemas.UserRead)
async def upload_my_avatar(
    avatar: UploadFile = File(...),
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    try:
        file_bytes = await avatar.read()
        return crud.upload_user_avatar(
            db,
            current_user.id,
            file_bytes,
            avatar.filename or "avatar",
            avatar.content_type,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/users/{user_id}/avatar")
def download_user_avatar(
    user_id: int,
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    try:
        path_value, filename, media_type = crud.get_user_avatar(db, user_id)
        return FileResponse(path_value, filename=filename, media_type=media_type)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/users/me/avatar", response_model=schemas.UserRead)
def delete_my_avatar(
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    try:
        return crud.delete_user_avatar(db, current_user.id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    owner: models.User = Depends(auth.require_owner),
    db: Session = Depends(get_db),
):
    try:
        crud.delete_user(db, user_id, owner.id)
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
