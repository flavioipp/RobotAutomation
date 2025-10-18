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
    # Make the base paths configurable via environment variables to avoid hard-coded OS-specific paths.
    # If not provided, default to a `repos` directory next to the project root and a `working` directory.
    def _clean_env(v):
        if v is None:
            return None
        s = str(v).strip()
        # remove surrounding single or double quotes if present
        if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
            s = s[1:-1].strip()
        return s

    REPOS_BASE_PATH = _clean_env(os.getenv('REPOS_BASE_PATH')) or str(pathlib.Path(BASE_DIR).parent.joinpath('repos'))
    # ensure directory exists (no-op if it already exists)
    try:
        pathlib.Path(REPOS_BASE_PATH).mkdir(parents=True, exist_ok=True)
    except Exception:
        # ignore creation errors here; the runtime will still attempt operations and fail if path is invalid
        pass

    # WORKING PATH SETTINGS for Robot Framework execution
    WORKING_BASE_PATH = _clean_env(os.getenv('WORKING_BASE_PATH')) or str(pathlib.Path(BASE_DIR).parent.joinpath('working'))
    try:
        pathlib.Path(WORKING_BASE_PATH).mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    SUITES_FOLDER = 'suites'
    # Optional: default repository used by the Script Browser when only one repo is intended
    SCRIPT_REPO_NAME = _clean_env(os.getenv('SCRIPT_REPO_NAME')) or None
    
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
