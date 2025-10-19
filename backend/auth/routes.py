from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import SessionLocal
from backend.db.models import User
from backend.auth.schemas import UserCreate, UserLogin, Token
from backend.core.security import get_password_hash, verify_password, create_access_token, get_username_from_token
from backend.db.models import User as DbUser

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register")
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"msg": "User created", "id": new_user.id}

@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/users")
def list_users(username: str = Depends(get_username_from_token), db: Session = Depends(get_db)):
    """Return list of users (id, username, email, role). Protected endpoint."""
    users = db.query(DbUser).all()
    result = []
    for u in users:
        result.append({"id": u.id, "username": u.username, "email": u.email, "role": u.role})
    return result
