import os
from dotenv import load_dotenv
import pathlib

# Carica .env relativo alla root del progetto (una directory sopra `backend/core`)
here = pathlib.Path(__file__).resolve().parent
project_root_dotenv = here.parent.joinpath('.env')
if project_root_dotenv.exists():
    load_dotenv(project_root_dotenv)
else:
    # fallback: prova a caricare .env dalla current working directory se presente
    load_dotenv()

class Settings:
    SQLALCHEMY_DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://robotuser:robotpass@localhost:3306/robotdb"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change_this_secret")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

settings = Settings()
