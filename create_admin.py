#!/usr/bin/env python3
import getpass
from backend.db.session import SessionLocal
from backend.db.models import User
from backend.core.security import get_password_hash

def create_admin(username, email, password):
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == username).first():
            print("Username già esistente.")
            return
        admin = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        print("Admin creato:", username)
    finally:
        db.close()

if __name__ == "__main__":
    username = input("admin username: ").strip()
    email = input("admin email: ").strip()
    password = getpass.getpass("admin password: ")
    create_admin(username, email, password)
