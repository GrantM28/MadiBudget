import os
import base64
import binascii
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models
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
except Exception:  # pragma: no cover - legacy fallback only
    CryptContext = None


legacy_pwd_context = (
    CryptContext(schemes=["bcrypt"], deprecated="auto")
    if CryptContext is not None
    else None
)


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


def create_access_token(username: str, session_version: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=AUTH_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "sv": session_version,
        "exp": expires_at,
    }
    return jwt.encode(payload, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM)


def get_user_by_username(db: Session, username: str) -> models.User | None:
    return db.scalar(
        select(models.User).where(func.lower(models.User.username) == username.strip().lower())
    )


def authenticate_user(db: Session, username: str, password: str) -> models.User | None:
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def require_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            AUTH_SECRET_KEY,
            algorithms=[AUTH_ALGORITHM],
        )
        username = payload.get("sub")
        session_version = payload.get("sv", 0)
    except JWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        ) from error

    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is not available.",
        )
    if int(user.session_version or 0) != int(session_version):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This session is no longer valid. Please sign in again.",
        )

    return user
