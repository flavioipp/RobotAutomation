from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from backend.core.config import settings
from fastapi import Depends, HTTPException, Header
from jose import JWTError
from typing import Optional


def get_username_from_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract username (sub) from a Bearer token in Authorization header.

    Returns username (string) or raises HTTPException(401) if token invalid.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail='Missing Authorization header')
    try:
        scheme, token = authorization.split(None, 1)
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid Authorization header')
    if scheme.lower() != 'bearer':
        raise HTTPException(status_code=401, detail='Invalid auth scheme')
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get('sub')
    except JWTError:
        raise HTTPException(status_code=401, detail='Invalid token')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_minutes: int = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
