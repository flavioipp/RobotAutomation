import os
from dotenv import load_dotenv

load_dotenv('../.env')
class Settings:
    SQLALCHEMY_DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://robotuser:robotpass@localhost:3306/robotdb"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change_this_secret")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

settings = Settings()
