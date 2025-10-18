import os
from dotenv import load_dotenv
import pathlib

# Load .env relative to the project root (one directory above `backend/core`)
here = pathlib.Path(__file__).resolve().parent
project_root_dotenv = here.parent.joinpath('.env')
if project_root_dotenv.exists():
    load_dotenv(project_root_dotenv)
else:
    # fallback: try loading .env from the current working directory if present
    load_dotenv()

class Settings:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    #DB SETYTINGS
    SQLALCHEMY_DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://robotuser:robotpass@localhost:3306/robotdb"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change_this_secret")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # GIT SETTINGS
    REPOS_BASE_PATH = '/Users/flavioippolito/Documents/GitHub'
    #REPOS_BASE_PATH = os.path.join(BASE_DIR, "..", "repos")  # percorso assoluto a ./repos
    #os.makedirs(REPOS_BASE_PATH, exist_ok=True)
settings = Settings()
# Log the resolved paths so they are obvious at startup
import logging
logger = logging.getLogger(__name__)
if not logger.handlers:
    # configure a simple handler for cases where the app didn't configure logging yet
    logging.basicConfig(level=logging.INFO)

logger.info("Config: REPOS_BASE_PATH=%s", settings.REPOS_BASE_PATH)
logger.info("Config: WORKING_BASE_PATH=%s", settings.WORKING_BASE_PATH)
logger.info("Config: SUITES_FOLDER=%s", settings.SUITES_FOLDER)
logger.info("Config: SCRIPT_REPO_NAME=%s", settings.SCRIPT_REPO_NAME)
