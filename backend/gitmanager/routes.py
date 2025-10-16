from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.db.session import SessionLocal
from backend.gitmanager.service import clone_or_pull
from backend.db.models import Repo, Script
from pathlib import Path
import os
from backend.core.config import settings
from jose import jwt, JWTError
import re
import json
from pydantic import BaseModel
from typing import List
from git import Repo as GitRepo, GitCommandError

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
            # hide repository-internal 'suites' directories from filesystem listings
            if child.is_dir() and child.name == settings.SUITES_FOLDER:
                continue
            entries.append({
                "name": child.name,
                "path": str(child.relative_to(repo_dir)),
                "is_dir": child.is_dir()
            })
    else:
        raise HTTPException(status_code=400, detail="Path is not a directory")

    return entries

@router.get('/fs/config')
def fs_get_config():
    """Return minimal filesystem config for frontend: configured SCRIPT_REPO_NAME and available repos."""
    configured = settings.SCRIPT_REPO_NAME
    base = Path(settings.REPOS_BASE_PATH)
    repos = []
    if base.exists():
        repos = [p.name for p in sorted(base.iterdir()) if p.is_dir()]
    return { 'script_repo_name': configured, 'available_repos': repos }


class CheckoutPayload(BaseModel):
    branch: str


@router.post('/fs/checkout')
def fs_checkout(payload: CheckoutPayload):
    """Checkout the given branch in the configured script repo.

    This operates on the repo specified by `settings.SCRIPT_REPO_NAME`.
    """
    repo_name = settings.SCRIPT_REPO_NAME
    if not repo_name:
        raise HTTPException(status_code=400, detail="No SCRIPT_REPO_NAME configured")
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo_name)
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Configured repo not found on disk")
    try:
        grepo = GitRepo(str(repo_dir))
        grepo.git.checkout(payload.branch)
    except GitCommandError as e:
        raise HTTPException(status_code=500, detail=f"Git error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not checkout branch: {e}")
    return { 'repo': repo_name, 'branch': payload.branch }
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
            # hide repository-internal 'suites' directories from filesystem listings
            if child.is_dir() and child.name == 'suites':
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


class SuitePayload(BaseModel):
    repo: str
    name: str
    files: List[str]


def _extract_username_from_request(request: Request):
    """Try to extract the username from an Authorization: Bearer <token> header.

    Returns the username string on success or None if no valid token is present.
    """
    auth = None
    if request is None:
        return None
    # headers are case-insensitive but FastAPI/Starlette exposes them lower-cased
    auth = request.headers.get('authorization') or request.headers.get('Authorization')
    if not auth:
        return None
    parts = auth.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    token = parts[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get('sub')
        return username
    except JWTError:
        return None


def _resolve_suites_dir(repo: str, request: Request):
    """Resolve where suites should be stored/read for the given repo and request.

    If a valid Authorization token with a 'sub' (username) is present, return
    WORKING_BASE_PATH/<username>/<SUITES_FOLDER>. Otherwise, fall back to
    the repository-local <repo>/suites directory (historic behavior).
    """
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    username = _extract_username_from_request(request)
    if username:
        # per-user working dir
        working = Path(settings.WORKING_BASE_PATH)
        per_user = (working / username / settings.SUITES_FOLDER).resolve()
        try:
            per_user.mkdir(parents=True, exist_ok=True)
        except Exception:
            # directory creation errors will surface later when writing files
            pass
        return per_user, repo_dir

    # fallback to repository-local suites
    return (repo_dir / settings.SUITES_FOLDER), repo_dir


@router.post("/fs/save-suite")
def fs_save_suite(payload: SuitePayload, request: Request):
    repo = payload.repo
    name = payload.name
    files = payload.files
    """Save a test suite manifest (JSON) under repo/suites/<name>.json.

    Payload:
    - repo: repository directory name
    - name: suite name (filename-safe)
    - files: array of relative file paths inside the repo
    """
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Repo not found on disk")

    # basic validation for suite name (avoid traversal)
    if not name or '/' in name or '\\' in name:
        raise HTTPException(status_code=400, detail="Invalid suite name")

    # ensure files are inside the repo and not hidden
    clean_files = []
    for f in files:
        target = (repo_dir / f).resolve()
        try:
            target.relative_to(repo_dir)
        except Exception:
            raise HTTPException(status_code=400, detail=f"File '{f}' is outside the repo")
        # do not allow hidden files
        if _is_hidden(target, repo_dir):
            raise HTTPException(status_code=400, detail=f"File '{f}' is hidden")
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail=f"File '{f}' not found")
        clean_files.append(str(target.relative_to(repo_dir)))

    suites_dir, _repo_dir = _resolve_suites_dir(repo, request)
    try:
        suites_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create suites directory: {e}")

    manifest = {
        'name': name,
        'files': clean_files
    }

    out_path = suites_dir / f"{name}.json"
    try:
        out_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not write suite manifest: {e}")

    # also generate a .robot file that runs each script using the Process library
    robot_lines = []
    robot_lines.append("*** Settings ***")
    robot_lines.append("Library    Process")
    robot_lines.append("")
    robot_lines.append("*** Test Cases ***")
    for f_rel in clean_files:
        # test case name from filename
        name_tc = Path(f_rel).stem.replace('_', ' ')
        robot_lines.append(name_tc)
        # compute path relative to suites directory
        try:
            rel_from_suites = str((repo_dir / f_rel).relative_to(suites_dir))
        except Exception:
            # fallback to ../ relative path
            rel_from_suites = os.path.relpath(str(repo_dir / f_rel), start=str(suites_dir))
        # Use ${CURDIR} so path resolves relative to the .robot location
        robot_lines.append(f"    Run Process    python    ${{CURDIR}}/{rel_from_suites}")
        robot_lines.append("")

    out_robot = suites_dir / f"{name}.robot"
    try:
        out_robot.write_text('\n'.join(robot_lines), encoding='utf-8')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not write robot suite file: {e}")

    # When suites are stored outside the repo_dir (working path), returning
    # a relative path to the repo would fail. Attempt relative-to-repo first,
    # otherwise return the absolute path.
    try:
        out_path_rel = str(out_path.relative_to(repo_dir))
    except Exception:
        out_path_rel = str(out_path)
    try:
        out_robot_rel = str(out_robot.relative_to(repo_dir))
    except Exception:
        out_robot_rel = str(out_robot)

    return {"path": out_path_rel, "manifest": manifest, "robot": out_robot_rel}


@router.get("/fs/list-suites")
def fs_list_suites(repo: str, request: Request):
    """List suite manifests under repo/suites/*.json and return their content plus robot path if present."""
    suites_dir, repo_dir = _resolve_suites_dir(repo, request)
    if not suites_dir.exists() or not suites_dir.is_dir():
        return []

    results = []
    for f in sorted(suites_dir.iterdir()):
        if not f.is_file() or f.suffix.lower() != '.json':
            continue
        try:
            content = f.read_text(encoding='utf-8')
            manifest = json.loads(content)
        except Exception:
            manifest = None
        robot_path = None
        robot_candidate = suites_dir / (f.stem + '.robot')
        if robot_candidate.exists() and robot_candidate.is_file():
            try:
                robot_path = str(robot_candidate.relative_to(repo_dir))
            except Exception:
                robot_path = str(robot_candidate)
        try:
            fpath = str(f.relative_to(repo_dir))
        except Exception:
            fpath = str(f)
        results.append({
            'name': f.stem,
            'path': fpath,
            'manifest': manifest,
            'robot': robot_path
        })

    return results


@router.get("/fs/suite-file")
def fs_get_suite_file(repo: str, name: str, request: Request):
    """Return the content of the generated .robot file for a suite name under repo/suites/<name>.robot"""
    base = Path(settings.REPOS_BASE_PATH)
    repo_dir = (base / repo).resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise HTTPException(status_code=404, detail="Repo not found on disk")

    suites_dir, _repo_dir = _resolve_suites_dir(repo, request)
    robot_path = suites_dir / f"{name}.robot"

    if not robot_path.exists() or not robot_path.is_file():
        raise HTTPException(status_code=404, detail="Robot file not found")

    try:
        content = robot_path.read_text(encoding='utf-8')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read robot file: {e}")

    try:
        robot_rel = str(robot_path.relative_to(repo_dir))
    except Exception:
        robot_rel = str(robot_path)

    return {"path": robot_rel, "content": content}
