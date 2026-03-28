from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..db import get_db


router = APIRouter(prefix="/auth", tags=["auth"])


def _user_count(db: Session) -> int:
    return db.scalar(select(func.count(models.User.id))) or 0


@router.get("/status", response_model=schemas.AuthStatusRead)
def auth_status(db: Session = Depends(get_db)):
    return {"setup_required": _user_count(db) == 0}


@router.post("/setup", response_model=schemas.AuthSessionRead, status_code=201)
def setup_first_user(payload: schemas.UserSetupCreate, db: Session = Depends(get_db)):
    if _user_count(db) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Initial setup has already been completed.",
        )

    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must contain at least 3 non-space characters.",
        )

    try:
        user = models.User(
            username=username,
            password_hash=auth.hash_password(payload.password),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That username is already in use.",
        ) from error
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to create the first login: {error.__class__.__name__}",
        ) from error

    return {
        "access_token": auth.create_access_token(user.username, int(user.session_version or 0)),
        "token_type": "bearer",
        "user": user,
    }


@router.post("/login", response_model=schemas.AuthSessionRead)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    return {
        "access_token": auth.create_access_token(user.username, int(user.session_version or 0)),
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: models.User = Depends(auth.require_current_user)):
    return current_user


@router.post("/change-password", status_code=204)
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    if not auth.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = auth.hash_password(payload.new_password)
    current_user.session_version = int(current_user.session_version or 0) + 1
    db.commit()
    return None


@router.post("/logout-all", status_code=204)
def logout_all_sessions(
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    current_user.session_version = int(current_user.session_version or 0) + 1
    db.commit()
    return None
