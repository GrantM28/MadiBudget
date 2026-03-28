from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..db import get_db


router = APIRouter(prefix="/auth", tags=["auth"])


def _user_count(db: Session) -> int:
    return db.scalar(select(func.count(models.User.id))) or 0


@router.get("/status", response_model=schemas.AuthStatusRead)
def auth_status(db: Session = Depends(get_db)):
    return {"setup_required": _user_count(db) == 0}


@router.post("/setup", response_model=schemas.AuthSessionRead, status_code=201)
def setup_first_user(
    payload: schemas.UserSetupCreate,
    request: Request,
    db: Session = Depends(get_db),
):
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

    email = payload.email.strip() if payload.email else None
    if email and auth.get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That email is already in use.",
        )

    try:
        user = models.User(
            display_name=payload.display_name.strip(),
            username=username,
            email=email,
            role="owner",
            password_hash=auth.hash_password(payload.password),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        session = auth.create_session(db, user, request)
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
        "access_token": auth.create_access_token(user, session),
        "token_type": "bearer",
        "user": auth.serialize_user(user),
    }


@router.post("/login", response_model=schemas.AuthSessionRead)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    session = auth.create_session(db, user, request)
    return {
        "access_token": auth.create_access_token(user, session),
        "token_type": "bearer",
        "user": auth.serialize_user(user),
    }


@router.get("/me", response_model=schemas.UserRead)
def me(current_user: models.User = Depends(auth.require_current_user)):
    return auth.serialize_user(current_user)


@router.get("/sessions", response_model=list[schemas.ActiveSessionRead])
def get_sessions(auth_context=Depends(auth.get_auth_context), db: Session = Depends(get_db)):
    current_user = auth_context["user"]
    current_session = auth_context["session"]
    return auth.get_active_sessions_for_user(db, current_user.id, current_session.token_id)


@router.post("/logout-current", status_code=204)
def logout_current(
    current_session: models.AuthSession = Depends(auth.require_current_session),
    db: Session = Depends(get_db),
):
    auth.revoke_session(db, current_session)
    return Response(status_code=204)


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
    auth.revoke_all_user_sessions(db, current_user)
    return Response(status_code=204)


@router.post("/logout-all", status_code=204)
def logout_all_sessions(
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    current_user.session_version = int(current_user.session_version or 0) + 1
    db.commit()
    auth.revoke_all_user_sessions(db, current_user)
    return Response(status_code=204)


@router.put("/me", response_model=schemas.UserRead)
def update_me(
    payload: schemas.UserUpdateSelf,
    current_user: models.User = Depends(auth.require_current_user),
    db: Session = Depends(get_db),
):
    try:
        return crud.update_user_self(db, current_user.id, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
