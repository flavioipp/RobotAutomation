from fastapi import FastAPI
from backend.auth.routes import router as auth_router

app = FastAPI(title="RobotFramework Suite Builder - Backend")

app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.get("/")
def root():
    return {"msg": "Backend FastAPI pronto 🚀"}
