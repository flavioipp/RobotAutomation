from fastapi import FastAPI
from backend.auth.routes import router as auth_router
from backend.gitmanager.routes import router as git_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="K@TE - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(git_router, prefix="/git", tags=["git"])
# expose selected gitmanager routes also under /db for direct DB-related APIs
app.include_router(git_router, prefix="/db", tags=["db"])

@app.get("/")
def root():
    return {"msg": "K@TE backend pronto 🚀"}
