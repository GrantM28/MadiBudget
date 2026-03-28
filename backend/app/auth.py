import base64
import binascii
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas
from .db import get_db


bearer_scheme = HTTPBearer(auto_error=False)

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "madibudget-dev-change-me")
AUTH_ALGORITHM = "HS256"
AUTH_TOKEN_EXPIRE_HOURS = int(os.getenv("AUTH_TOKEN_EXPIRE_HOURS", "12"))
PASSWORD_HASH_ITERATIONS = int(os.getenv("PASSWORD_HASH_ITERATIONS", "390000"))
PASSWORD_HASH_SCHEME = "pbkdf2_sha256"
PASSWORD_SALT_BYTES = 16

try:
    from passlib.context import CryptContext
except Exception:  # pragma: no cover - optional legacy support
    CryptContext = None


legacy_pwd_context = (
    CryptContext(schemes=["bcrypt"], deprecated="auto")
    if CryptContext is not None
    else None
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _encode_base64(value: bytes) -> str:
    return base64.b64encode(value).decode("utf-8")


def _decode_base64(value: str) -> bytes:
    return base64.b64decode(value.encode("utf-8"))


def _pbkdf2_hash(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(PASSWORD_SALT_BYTES)
    digest = _pbkdf2_hash(password, salt, PASSWORD_HASH_ITERATIONS)
    return (
        f"{PASSWORD_HASH_SCHEME}"
        f"${PASSWORD_HASH_ITERATIONS}"
        f"${_encode_base64(salt)}"
        f"${_encode_base64(digest)}"
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(f"{PASSWORD_HASH_SCHEME}$"):
        try:
            _, iteration_text, salt_text, digest_text = hashed_password.split("$", 3)
            iterations = int(iteration_text)
            salt = _decode_base64(salt_text)
            expected_digest = _decode_base64(digest_text)
        except (ValueError, binascii.Error):
            return False

        calculated_digest = _pbkdf2_hash(plain_password, salt, iterations)
        return hmac.compare_digest(calculated_digest, expected_digest)

    if legacy_pwd_context is not None:
        try:
            return legacy_pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

    return False


def create_access_token(user: models.User, session: models.AuthSession) -> str:
    payload = {
        "sub": str(user.id),
        "sid": session.token_id,
        "sv": int(user.session_version or 0),
        "exp": session.expires_at,
    }
    return jwt.encode(payload, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM)


def get_user_by_username(db: Session, username: str) -> models.User | None:
    return db.scalar(
        select(models.User).where(func.lower(models.User.username) == username.strip().lower())
    )


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.scalar(
        select(models.User).where(func.lower(models.User.email) == email.strip().lower())
    )


def get_user_by_identity(db: Session, identity: str) -> models.User | None:
    if identity.isdigit():
        return db.get(models.User, int(identity))
    return get_user_by_username(db, identity)


def authenticate_user(db: Session, username: str, password: str) -> models.User | None:
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def user_initials(user: models.User | schemas.UserRead) -> str:
    source = (getattr(user, "display_name", None) or getattr(user, "username", "") or "").strip()
    parts = [part for part in source.replace("_", " ").split() if part]
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    if parts:
        return parts[0][:2].upper()
    return "MB"


def serialize_user(user: models.User) -> schemas.UserRead:
    return schemas.UserRead(
        id=user.id,
        display_name=user.display_name or user.username,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        has_avatar=bool(user.avatar_path),
        avatar_name=user.avatar_name,
        initials=user_initials(user),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def create_session(
    db: Session,
    user: models.User,
    request: Request | None = None,
) -> models.AuthSession:
    now = _now_utc()
    session = models.AuthSession(
        user_id=user.id,
        token_id=secrets.token_urlsafe(24),
        user_agent=request.headers.get("user-agent")[:500] if request else None,
        ip_address=(request.client.host if request and request.client else None),
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=AUTH_TOKEN_EXPIRE_HOURS),
    )
    db.add(session)
    user.last_login_at = now
    db.commit()
    db.refresh(session)
    db.refresh(user)
    return session


def revoke_session(db: Session, session: models.AuthSession):
    session.revoked_at = _now_utc()
    db.commit()


def revoke_all_user_sessions(db: Session, user: models.User):
    now = _now_utc()
    sessions = db.scalars(
        select(models.AuthSession).where(
            models.AuthSession.user_id == user.id,
            models.AuthSession.revoked_at.is_(None),
        )
    ).all()
    for session in sessions:
        session.revoked_at = now
    db.commit()


def get_active_sessions_for_user(
    db: Session,
    user_id: int,
    current_session_token_id: str | None = None,
) -> list[schemas.ActiveSessionRead]:
    now = _now_utc()
    sessions = db.scalars(
        select(models.AuthSession)
        .where(
            models.AuthSession.user_id == user_id,
            models.AuthSession.revoked_at.is_(None),
            models.AuthSession.expires_at >= now,
        )
        .order_by(models.AuthSession.last_seen_at.desc(), models.AuthSession.created_at.desc())
    ).all()

    return [
        schemas.ActiveSessionRead(
            id=session.id,
            token_id=session.token_id,
            user_agent=session.user_agent,
            ip_address=session.ip_address,
            created_at=session.created_at,
            last_seen_at=session.last_seen_at,
            expires_at=session.expires_at,
            current=session.token_id == current_session_token_id,
        )
        for session in sessions
    ]


def _decode_token_or_raise(credentials: HTTPAuthorizationCredentials | None):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    try:
        return jwt.decode(
            credentials.credentials,
            AUTH_SECRET_KEY,
            algorithms=[AUTH_ALGORITHM],
        )
    except JWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from error


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    payload = _decode_token_or_raise(credentials)
    user_identity = str(payload.get("sub") or "").strip()
    session_version = int(payload.get("sv", 0))
    session_token_id = str(payload.get("sid") or "").strip()

    if not user_identity or not session_token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    user = get_user_by_identity(db, user_identity)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is not available.",
        )

    if int(user.session_version or 0) != session_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session is no longer valid. Please sign in again.",
        )

    session = db.scalar(
        select(models.AuthSession).where(models.AuthSession.token_id == session_token_id)
    )
    now = _now_utc()
    if (
        not session
        or session.user_id != user.id
        or session.revoked_at is not None
        or session.expires_at < now
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session is no longer valid. Please sign in again.",
        )

    session.last_seen_at = now
    db.commit()
    db.refresh(session)
    return {"user": user, "session": session}


def require_current_user(auth_context=Depends(get_auth_context)) -> models.User:
    return auth_context["user"]


def require_current_session(auth_context=Depends(get_auth_context)) -> models.AuthSession:
    return auth_context["session"]


def require_owner(current_user: models.User = Depends(require_current_user)) -> models.User:
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the household owner can do that.",
        )
    return current_user
