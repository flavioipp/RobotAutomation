from backend.db.session import engine
from backend.db.base import Base
# importa i modelli così vengono registrati nella metadata
import backend.db.models

if __name__ == "__main__":
    print("Creazione tabelle nel DB...")
    Base.metadata.create_all(bind=engine)
    print("Fatto.")
