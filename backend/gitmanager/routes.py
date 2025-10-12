from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import SessionLocal
from backend.gitmanager.service import clone_or_pull
from backend.db.models import Repo, Script
from pathlib import Path
import os
from backend.core.config import settings
import re

router = APIRouter()


def _is_hidden(path: Path, repo_dir: Path) -> bool:
    """Return True if any path segment of `path` relative to `repo_dir` starts with a dot.

    This is used to hide dotfiles and dot-directories from filesystem listings.
    """
    try:
        rel = path.relative_to(repo_dir)
    except Exception:
        return False
    for part in rel.parts:
        if part.startswith('.'):
            return True
    return False


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


# Filesystem-based endpoints (do not depend on DB):
@router.get("/fs/repos")
def fs_list_repos():
    """List repository directories under the configured REPOS_BASE_PATH."""
    base = Path(settings.REPOS_BASE_PATH)
    if not base.exists():
        return []
    repos = [p.name for p in sorted(base.iterdir()) if p.is_dir()]
    return repos


@router.get("/fs/list")
def fs_list(repo: str, path: str = '.'):
    """List files and directories for a repo at a given relative path.

    Parameters:
    - repo: repository directory name under REPOS_BASE_PATH
    - path: relative path inside the repo (default '.')
    """
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Repo not found on disk")

    target = (repo_dir / path).resolve()
    # ensure target is inside repo_dir
    try:
        target.relative_to(repo_dir)
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    entries = []
    if target.is_dir():
        for child in sorted(target.iterdir()):
            # skip hidden files/dirs (any path segment starting with '.')
            if _is_hidden(child, repo_dir):
                continue
            entries.append({
                "name": child.name,
                "path": str(child.relative_to(repo_dir)),
                "is_dir": child.is_dir()
            })
    else:
        raise HTTPException(status_code=400, detail="Path is not a directory")

    return entries


@router.get("/fs/file")
def fs_get_file(repo: str, path: str):
    """Return the content of a file inside a repo (by repo name and relative path)."""
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Repo not found on disk")

    target = (repo_dir / path).resolve()
    try:
        target.relative_to(repo_dir)
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        content = target.read_text(encoding='utf-8')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read file: {e}")

    return {"path": str(target.relative_to(repo_dir)), "content": content}


@router.get("/fs/meta")
def fs_get_meta(repo: str, path: str):
    """Extract simple metadata from the top-level docstring of a file.

    Returns JSON with optional keys: description, topology, author
    """
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Repo not found on disk")

    target = (repo_dir / path).resolve()
    try:
        target.relative_to(repo_dir)
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        content = target.read_text(encoding='utf-8')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read file: {e}")

    # find a top-level triple-quoted docstring (''' or """) near the start
    # allow for shebang/encoding/license header before the docstring by searching
    snippet = content[:4096]
    m = re.search(r"(?P<quote>['\"]{3})(?P<doc>.*?)(?P=quote)", snippet, re.S)
    doc = m.group('doc').strip() if m else ''

    # fallback: if no triple-quoted docstring, consider an initial block of '#' comments
    if not doc:
        # collect consecutive leading comment lines (skip blank lines at very top)
        comment_lines = []
        for line in snippet.splitlines():
            s = line.strip()
            if not s:
                # stop if we've already collected comment lines and hit a blank line
                if comment_lines:
                    break
                else:
                    continue
            if s.startswith('#'):
                # remove leading '#' and any one space
                comment_lines.append(s.lstrip('#').strip())
            else:
                # stop at first non-comment non-blank line
                break
        if comment_lines:
            doc = '\n'.join(comment_lines).strip()

    description = None
    topology = None
    author = None
    explicit_fields = {"description": False, "topology": False, "author": False}

    if doc:
        # search for explicit ':field Key: value' lines (case-insensitive), e.g. ':field Description: ...'
        field_re = re.compile(r'(?i)^:field\s+(description|topology|author)\s*:\s*(.+)$')
        for line in doc.splitlines():
            line_stripped = line.strip()
            if not line_stripped:
                continue
            mfield = field_re.match(line_stripped)
            if mfield:
                key = mfield.group(1).lower()
                val = mfield.group(2).strip()
                if key == 'description':
                    description = val
                    explicit_fields['description'] = True
                    continue
                if key == 'topology':
                    topology = val
                    explicit_fields['topology'] = True
                    continue
                if key == 'author':
                    author = val
                    explicit_fields['author'] = True
                    continue

        # fallback: use first paragraph as description if not found
        if not description:
            paragraphs = [p.strip() for p in doc.split('\n\n') if p.strip()]
            if paragraphs:
                description = paragraphs[0].splitlines()[0].strip()

    return {"path": str(target.relative_to(repo_dir)), "description": description, "topology": topology, "author": author, "explicit_fields": explicit_fields}


@router.get("/fs/meta-dir")
def fs_get_meta_dir(repo: str, path: str = '.'):
    """Return metadata for all files directly under the given directory (non-recursive)."""
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Repo not found on disk")

    target = (repo_dir / path).resolve()
    try:
        target.relative_to(repo_dir)
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail="Path not found or not a directory")

    metas = {}
    for child in sorted(target.iterdir()):
        # skip hidden files/dirs
        if _is_hidden(child, repo_dir):
            continue
        if child.is_file():
            try:
                # reuse the logic by reading file and applying same parsing
                content = child.read_text(encoding='utf-8')
            except Exception:
                metas[str(child.relative_to(repo_dir))] = None
                continue

            # mimic fs_get_meta parsing (docstring or leading comments)
            snippet = content[:4096]
            m = re.search(r"(?P<quote>['\"]{3})(?P<doc>.*?)(?P=quote)", snippet, re.S)
            doc = m.group('doc').strip() if m else ''
            if not doc:
                comment_lines = []
                for line in snippet.splitlines():
                    s = line.strip()
                    if not s:
                        if comment_lines:
                            break
                        else:
                            continue
                    if s.startswith('#'):
                        comment_lines.append(s.lstrip('#').strip())
                    else:
                        break
                if comment_lines:
                    doc = '\n'.join(comment_lines).strip()

            description = None
            topology = None
            author = None
            explicit_fields = {"description": False, "topology": False, "author": False}
            if doc:
                # first look for ':field Key: value' explicit patterns
                field_re = re.compile(r'(?i)^:field\s+(description|topology|author)\s*:\s*(.+)$')
                for line in doc.splitlines():
                    line_stripped = line.strip()
                    if not line_stripped:
                        continue
                    mfield = field_re.match(line_stripped)
                    if mfield:
                        k = mfield.group(1).lower()
                        v = mfield.group(2).strip()
                        if k == 'description':
                            description = v
                            explicit_fields['description'] = True
                            continue
                        if k == 'topology':
                            topology = v
                            explicit_fields['topology'] = True
                            continue
                        if k == 'author':
                            author = v
                            explicit_fields['author'] = True
                            continue

                # if explicit fields not present, fallback to 'Key: value' lines but do not mark them as explicit
                if not (explicit_fields['description'] or explicit_fields['topology'] or explicit_fields['author']):
                    for line in doc.splitlines():
                        line_stripped = line.strip()
                        if not line_stripped:
                            continue
                        kv = re.match(r'(?i)^(description)\s*:\s*(.+)$', line_stripped)
                        if kv:
                            description = kv.group(2).strip()
                            continue
                        kv = re.match(r'(?i)^(topology)\s*:\s*(.+)$', line_stripped)
                        if kv:
                            topology = kv.group(2).strip()
                            continue
                        kv = re.match(r'(?i)^(author)\s*:\s*(.+)$', line_stripped)
                        if kv:
                            author = kv.group(2).strip()
                            continue

                if not description:
                    paragraphs = [p.strip() for p in doc.split('\n\n') if p.strip()]
                    if paragraphs:
                        description = paragraphs[0].splitlines()[0].strip()

            metas[str(child.relative_to(repo_dir))] = {"path": str(child.relative_to(repo_dir)), "description": description, "topology": topology, "author": author, "explicit_fields": explicit_fields}

    return metas
