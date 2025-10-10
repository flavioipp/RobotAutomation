from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import SessionLocal
from backend.gitmanager.service import clone_or_pull
from backend.db.models import Repo, Script
from pathlib import Path
import os

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/sync")
def sync_repo(name: str, url: str, branch: str = "main", db: Session = Depends(get_db)):
    repo, scripts = clone_or_pull(db, name, url, branch)
    return {
        "msg": f"Repo '{repo.name}' sincronizzata in {repo.local_path}",
        "scripts_count": len(scripts)
    }


@router.get("/repos")
def list_repos(db: Session = Depends(get_db)):
    return db.query(Repo).all()


@router.get("/dirs")
def list_dirs(repo_id: int, db: Session = Depends(get_db)):
    """Return a sorted list of relative directories present in the repo (derived from scripts paths)."""
    repo = db.query(Repo).filter(Repo.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    base = Path(repo.local_path)
    dirs = set()
    scripts = db.query(Script).filter(Script.repo_id == repo_id).all()
    for s in scripts:
        try:
            rel = os.path.relpath(s.path, str(base))
        except Exception:
            # fallback to using full path
            rel = s.path
        dirname = os.path.dirname(rel)
        # normalize root to empty string
        if dirname == "":
            dirs.add(".")
        else:
            dirs.add(dirname)

    return sorted(list(dirs))


@router.get("/scripts")
def list_scripts(repo_id: int = None, dir: str = None, db: Session = Depends(get_db)):
    q = db.query(Script)
    if repo_id:
        q = q.filter(Script.repo_id == repo_id)

    if dir is not None:
        if not repo_id:
            raise HTTPException(status_code=400, detail="repo_id is required when filtering by dir")
        repo = db.query(Repo).filter(Repo.id == repo_id).first()
        if not repo:
            raise HTTPException(status_code=404, detail="Repo not found")
        # compute absolute prefix for the directory
        base = Path(repo.local_path)
        # interpret '.' as root
        if dir == '.' or dir == '':
            prefix = str(base)
        else:
            prefix = str(base / dir)
        # ensure prefix uses forward/back slashes consistently
        prefix = os.path.normpath(prefix)
        # filter by path starting with prefix
        q = q.filter(Script.path.like(f"{prefix}%"))

    scripts = q.all()
    result = []
    for s in scripts:
        result.append({
            "id": s.id,
            "path": s.path,
            "filename": s.filename,
            "description": s.description,
            "topology": s.topology,
            "author": s.author,
            "functions_doc": s.functions_doc
        })
    return result


@router.get("/scripts/{script_id}/content")
def get_script_content(script_id: int, db: Session = Depends(get_db)):
    """Return the raw content of a script file by id (safe: ensure file is inside repo local_path)."""
    s = db.query(Script).filter(Script.id == script_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Script not found")

    repo = db.query(Repo).filter(Repo.id == s.repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo for script not found")

    file_path = Path(s.path).resolve()
    repo_base = Path(repo.local_path).resolve()
    try:
        # ensure file is under repo_base
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="File not found on disk")
        # Py3.9+: is_relative_to
        if not file_path.is_relative_to(repo_base):
            raise HTTPException(status_code=403, detail="Access denied")
    except AttributeError:
        # fallback for older versions: compare parents
        try:
            file_path.relative_to(repo_base)
        except Exception:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read file: {e}")

    return {"id": s.id, "path": s.path, "content": content}
