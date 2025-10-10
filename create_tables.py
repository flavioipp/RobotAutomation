#!/usr/bin/env python3

from backend.db.session import engine
from backend.db.base import Base
# importa i modelli così vengono registrati nella metadata
import backend.db.models

if __name__ == "__main__":
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")
