from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.db.base import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    role = Column(String(50), default="user", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Repo(Base):
    __tablename__ = "repos"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    branch = Column(String(100), default="main")
    local_path = Column(String(500), nullable=False)
    last_sync = Column(DateTime(timezone=True))

    scripts = relationship("Script", back_populates="repo")

class Script(Base):
    __tablename__ = "scripts"
    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repos.id"))
    path = Column(String(500), nullable=False)
    filename = Column(String(255), nullable=False)
    module_doc = Column(Text)
    description = Column(Text)
    topology = Column(String(255))
    author = Column(String(255))
    functions_doc = Column(Text)  # JSON serializzato con i docstring funzioni
    # functions_doc: serialized JSON containing function docstrings
    last_commit = Column(String(40))

    repo = relationship("Repo", back_populates="scripts")


from . import t_models  # generated T_* models are kept in t_models.py
