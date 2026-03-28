from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
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

    user = models.User(
        username=payload.username.strip(),
        password_hash=auth.hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "access_token": auth.create_access_token(user.username),
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
        "access_token": auth.create_access_token(user.username),
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: models.User = Depends(auth.require_current_user)):
    return current_user
