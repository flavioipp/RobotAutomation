from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from backend.db.session import SessionLocal
from backend.gitmanager.service import clone_or_pull
from backend.db.models import Repo, Script, User
from backend.db import t_models as tmodels
from pathlib import Path
import os
from backend.core.config import settings
from backend.core.security import get_username_from_token
from fastapi import Query
from jose import jwt, JWTError
import re
import json
from pydantic import BaseModel, Field
from typing import List, Optional
from git import Repo as GitRepo, GitCommandError
from pydantic import constr

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


@router.get('/benches')
def list_benches_db(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Authenticated, paginated benches listing under /db/benches.

    Query parameters:
    - limit: number of rows to return (default 50, max 1000)
    - offset: row offset for pagination
    Requires a Bearer token in Authorization header.
    Returns JSON: { items: [...], limit, offset, total }
    """
    try:
        # Use ORM models for T_EQUIPMENT with optional joined brand info
        q = db.query(tmodels.TEquipment).options(joinedload(tmodels.TEquipment.brand))
        total = q.count()
        items = q.offset(offset).limit(limit).all()

        result_items = []
        for e in items:
            brand_name = None
            equip_type = None
            ip_addr = None
            net_in_use = None
            mask = None
            gateway = None
            try:
                brand_name = e.brand.brand_name if e.brand else None
            except Exception:
                brand_name = None
            try:
                equip_type = e.equip_type.name if e.equip_type else None
            except Exception:
                equip_type = None
            try:
                ip_addr = e.net.IP if e.net else None
                net_in_use = e.net.inUse if e.net else None
                # NM and GW columns in T_NET
                mask = getattr(e.net, 'NM', None) if e.net else None
                gateway = getattr(e.net, 'GW', None) if e.net else None
            except Exception:
                ip_addr = None
                net_in_use = None
                mask = None
                gateway = None

            result_items.append({
                'id': e.id_equipment,
                'name': e.name,
                'brand_id': e.T_BRAND_id_brand,
                'brand_name': brand_name,
                'equip_type': equip_type,
                'ip': ip_addr,
                'mask': mask,
                'gateway': gateway,
                'net_in_use': net_in_use,
                'owner': e.owner,
                'inUse': e.inUse,
                'description': getattr(e, 'description', None),
                'lib_id': getattr(e, 'T_LIB_id_lib', None),
                'lib_name': getattr(e.lib, 'lib_name', None) if getattr(e, 'lib', None) else None
            })
            # try to attach credentials if present
            try:
                creds = db.query(tmodels.TEqptCred).options(joinedload(tmodels.TEqptCred.eqpt_cred_type)).filter(tmodels.TEqptCred.T_EQUIPMENT_id_equipment == e.id_equipment).all()
                if creds:
                    cl = []
                    for c in creds:
                        # include both the FK id and the human-readable type from T_EQPT_CRED_TYPE.cr_type
                        cl.append({
                            'cred_id': getattr(c, 'cred_id', None),
                            'type_id': getattr(c, 'T_EQPT_CRED_TYPE_id_cred_type', None),
                            'type': getattr(c.eqpt_cred_type, 'cr_type', None) if getattr(c, 'eqpt_cred_type', None) else None,
                            'usr': getattr(c, 'usr', None),
                                # do NOT expose credential secrets in list endpoints; redact here
                                'pwd': None,
                            'port': getattr(c, 'port', None)
                        })
                    result_items[-1]['credentials'] = cl
                    # convenience fields (first credential) preserved for backwards-compatibility
                    result_items[-1]['credential_user'] = cl[0].get('usr')
                    # redact convenience secret as well
                    result_items[-1]['credential_secret'] = None
                    result_items[-1]['credential_port'] = cl[0].get('port')
                else:
                    result_items[-1]['credentials'] = []
                    result_items[-1]['credential_user'] = None
                    result_items[-1]['credential_secret'] = None
                    result_items[-1]['credential_port'] = None
            except Exception:
                result_items[-1]['credentials'] = []
                result_items[-1]['credential_user'] = None
                result_items[-1]['credential_secret'] = None
                result_items[-1]['credential_port'] = None

        return {'items': result_items, 'limit': limit, 'offset': offset, 'total': total}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not query benches (ORM): {e}")


@router.get('/benches/{bench_id}')
def get_bench_by_id(
    bench_id: int,
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Return a single bench by id."""
    try:
        e = db.query(tmodels.TEquipment).options(joinedload(tmodels.TEquipment.brand)).filter(tmodels.TEquipment.id_equipment == bench_id).first()
        if not e:
            raise HTTPException(status_code=404, detail="Bench not found")

        try:
            brand_name = e.brand.brand_name if e.brand else None
        except Exception:
            brand_name = None
        try:
            equip_type = e.equip_type.name if e.equip_type else None
        except Exception:
            equip_type = None
        try:
            ip_addr = e.net.IP if e.net else None
            net_in_use = e.net.inUse if e.net else None
            mask = getattr(e.net, 'NM', None) if e.net else None
            gateway = getattr(e.net, 'GW', None) if e.net else None
        except Exception:
            ip_addr = None
            net_in_use = None
            mask = None
            gateway = None

        # attempt to resolve owner username to a user id if present
        owner_id = None
        try:
            if e.owner:
                u = db.query(User).filter(User.username == e.owner).first()
                if u:
                    owner_id = u.id
        except Exception:
            owner_id = None

        item = {
            'id': e.id_equipment,
            'name': e.name,
            'brand_id': e.T_BRAND_id_brand,
            'brand_name': brand_name,
            'equip_type': equip_type,
            'equip_type_id': getattr(e, 'T_EQUIP_TYPE_id_type', None),
            'ip': ip_addr,
            'mask': mask,
            'gateway': gateway,
            'net_in_use': net_in_use,
            'owner': e.owner,
            'owner_id': owner_id,
            'inUse': e.inUse,
            'description': getattr(e, 'description', None),
            'lib_id': getattr(e, 'T_LIB_id_lib', None),
            'lib_name': getattr(e.lib, 'lib_name', None) if getattr(e, 'lib', None) else None
        }
        # include credentials for this equipment (T_EQPT_CRED)
        try:
            creds = db.query(tmodels.TEqptCred).options(joinedload(tmodels.TEqptCred.eqpt_cred_type)).filter(tmodels.TEqptCred.T_EQUIPMENT_id_equipment == bench_id).all()
            creds_list = []
            for c in creds:
                creds_list.append({
                    'cred_id': getattr(c, 'cred_id', None),
                    'type_id': getattr(c, 'T_EQPT_CRED_TYPE_id_cred_type', None),
                    'type': getattr(c.eqpt_cred_type, 'cr_type', None) if getattr(c, 'eqpt_cred_type', None) else None,
                    'usr': getattr(c, 'usr', None),
                    # never return password in this response
                    'pwd': None,
                    'port': getattr(c, 'port', None)
                })
            if creds_list:
                item['credentials'] = creds_list
            else:
                item['credentials'] = []
        except Exception:
            item['credentials'] = []
            item['credential_user'] = None
            item['credential_secret'] = None
            item['credential_port'] = None
        return item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not query bench (ORM): {e}")




@router.get('/benches/{bench_id}/credentials/{cred_id}')
def reveal_credential_secret(
    bench_id: int,
    cred_id: int,
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Return the secret (pwd) for a specific credential belonging to a bench.

    This endpoint is intentionally explicit and requires authentication. It returns
    { cred_id, pwd } if the credential exists and belongs to the requested bench.
    """
    try:
        c = db.query(tmodels.TEqptCred).filter(tmodels.TEqptCred.cred_id == cred_id, tmodels.TEqptCred.T_EQUIPMENT_id_equipment == bench_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Credential not found for this bench")
        # return only the secret and id; don't include other sensitive data
        return { 'cred_id': getattr(c, 'cred_id', None), 'pwd': getattr(c, 'pwd', None) }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reveal credential: {e}")


class CredentialUpdatePayload(BaseModel):
    usr: Optional[str] = None
    port: Optional[int] = None
    pwd: Optional[str] = None


class CredentialCreatePayload(BaseModel):
    type_id: int
    usr: Optional[str] = None
    port: Optional[str] = None
    pwd: Optional[str] = None


@router.post('/benches/{bench_id}/credentials')
def create_credential(
    bench_id: int,
    payload: CredentialCreatePayload,
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Create a new credential for a bench."""
    try:
        # ensure bench exists
        e = db.query(tmodels.TEquipment).filter(tmodels.TEquipment.id_equipment == bench_id).first()
        if not e:
            raise HTTPException(status_code=404, detail="Bench not found")
        provided = payload.model_dump(exclude_unset=True)
        # validate credential type exists
        t_id = provided.get('type_id')
        ct = db.query(tmodels.TEqptCredType).filter(tmodels.TEqptCredType.idT_EQPT_CRED_TYPE == t_id).first()
        if not ct:
            raise HTTPException(status_code=400, detail=f"Credential type id '{t_id}' not found")
        c = tmodels.TEqptCred()
        try:
            c.T_EQPT_CRED_TYPE_id_cred_type = t_id
        except Exception:
            pass
        try:
            c.T_EQUIPMENT_id_equipment = bench_id
        except Exception:
            pass
        if 'usr' in provided:
            try:
                c.usr = provided.get('usr')
            except Exception:
                pass
        if 'port' in provided:
            try:
                c.port = provided.get('port')
            except Exception:
                pass
        if 'pwd' in provided:
            try:
                c.pwd = provided.get('pwd')
            except Exception:
                pass
        db.add(c)
        db.commit()
        db.refresh(c)
        return {
            'cred_id': getattr(c, 'cred_id', None),
            'type_id': getattr(c, 'T_EQPT_CRED_TYPE_id_cred_type', None),
            'type': getattr(c.eqpt_cred_type, 'cr_type', None) if getattr(c, 'eqpt_cred_type', None) else None,
            'usr': getattr(c, 'usr', None),
            'pwd': None,
            'port': getattr(c, 'port', None)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not create credential: {e}")


@router.get('/credential-types')
def list_credential_types(db: Session = Depends(get_db)):
    """Return all credential types (T_EQPT_CRED_TYPE)."""
    try:
        rows = db.query(tmodels.TEqptCredType).all()
        result = []
        for r in rows:
            result.append({ 'id': getattr(r, 'idT_EQPT_CRED_TYPE', None), 'name': getattr(r, 'cr_type', None) })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not list credential types: {e}")


@router.patch('/benches/{bench_id}/credentials/{cred_id}')
def update_credential(
    bench_id: int,
    cred_id: int,
    payload: CredentialUpdatePayload,
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Update a credential (usr, port, pwd) for a specific bench. Returns the updated credential with pwd redacted."""
    try:
        c = db.query(tmodels.TEqptCred).filter(tmodels.TEqptCred.cred_id == cred_id, tmodels.TEqptCred.T_EQUIPMENT_id_equipment == bench_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Credential not found for this bench")
        provided = payload.model_dump(exclude_unset=True)
        if 'usr' in provided:
            try:
                c.usr = provided.get('usr')
            except Exception:
                pass
        if 'port' in provided:
            try:
                c.port = provided.get('port')
            except Exception:
                pass
        if 'pwd' in provided:
            try:
                c.pwd = provided.get('pwd')
            except Exception:
                pass
        db.add(c)
        db.commit()
        db.refresh(c)
        return {
            'cred_id': getattr(c, 'cred_id', None),
            'type_id': getattr(c, 'T_EQPT_CRED_TYPE_id_cred_type', None),
            'type': getattr(c.eqpt_cred_type, 'cr_type', None) if getattr(c, 'eqpt_cred_type', None) else None,
            'usr': getattr(c, 'usr', None),
            'pwd': None,
            'port': getattr(c, 'port', None)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not update credential: {e}")


@router.delete('/benches/{bench_id}/credentials/{cred_id}')
def delete_credential(
    bench_id: int,
    cred_id: int,
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Delete a credential for a bench."""
    try:
        c = db.query(tmodels.TEqptCred).filter(tmodels.TEqptCred.cred_id == cred_id, tmodels.TEqptCred.T_EQUIPMENT_id_equipment == bench_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Credential not found for this bench")
        db.delete(c)
        db.commit()
        return { 'deleted': cred_id }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not delete credential: {e}")


class BenchUpdatePayload(BaseModel):
    # Partial payload: name and/or owner_id/brand_id may be provided. Both optional for PATCH semantics.
    name: Optional[str] = Field(None, min_length=1, pattern=r"^\S+$")
    owner_id: Optional[int] = None
    brand_id: Optional[int] = None
    equip_type_id: Optional[int] = None
    mask: Optional[str] = None
    gateway: Optional[str] = None
    ip: Optional[str] = None
    description: Optional[str] = None
    lib_id: Optional[int] = None


@router.patch('/benches/{bench_id}')
def update_bench_name(
    bench_id: int,
    payload: BenchUpdatePayload,
    username: str = Depends(get_username_from_token),
    db: Session = Depends(get_db)
):
    """Update bench fields (supports `name` and `owner`).

    - `name`: must be non-empty and contain no whitespace if provided.
    - `owner`: username of an existing user (or null) if provided.
    """
    try:
        e = db.query(tmodels.TEquipment).filter(tmodels.TEquipment.id_equipment == bench_id).first()
        if not e:
            raise HTTPException(status_code=404, detail="Bench not found")
        # determine which fields were provided in the PATCH payload
        provided = payload.model_dump(exclude_unset=True)
        if 'name' in provided:
            # payload.name already validated by Pydantic (no whitespace)
            e.name = payload.name
        if 'owner_id' in provided:
            # allow clearing owner by sending null
            owner_id_val = provided.get('owner_id')
            if owner_id_val is None:
                e.owner = None
            else:
                u = db.query(User).filter(User.id == owner_id_val).first()
                if not u:
                    raise HTTPException(status_code=400, detail=f"Owner id '{owner_id_val}' not found")
                e.owner = u.username
        if 'brand_id' in provided:
            brand_id_val = provided.get('brand_id')
            if brand_id_val is None:
                e.T_BRAND_id_brand = None
            else:
                # validate brand exists in TBrand table
                b = db.query(tmodels.TBrand).filter(tmodels.TBrand.id_brand == brand_id_val).first()
                if not b:
                    raise HTTPException(status_code=400, detail=f"Brand id '{brand_id_val}' not found")
                e.T_BRAND_id_brand = brand_id_val
        if 'equip_type_id' in provided:
            et_id = provided.get('equip_type_id')
            if et_id is None:
                # depending on schema, this FK may be nullable; set to None
                try:
                    e.T_EQUIP_TYPE_id_type = None
                except Exception:
                    pass
            else:
                et = db.query(tmodels.TEquipType).filter(tmodels.TEquipType.id_type == et_id).first()
                if not et:
                    raise HTTPException(status_code=400, detail=f"Equip type id '{et_id}' not found")
                # set FK column; model field name may be T_EQUIP_TYPE_id_type
                try:
                    e.T_EQUIP_TYPE_id_type = et_id
                except Exception:
                    # fallback: if model uses different attribute, try setting via relationship
                    try:
                        e.equip_type = et
                    except Exception:
                        raise HTTPException(status_code=500, detail="Could not set equip type")

        # handle IP/mask/gateway updates: these live in the T_NET table (relationship e.net)
        if 'ip' in provided:
            ip_val = provided.get('ip')
            # if payload explicitly sets ip to null/None, attempt to unlink
            if ip_val is None:
                try:
                    e.T_NET_id_ip = None
                except Exception:
                    try:
                        # fallback: if relationship is assignable
                        e.net = None
                    except Exception:
                        pass
            else:
                # 1) deny if another equipment already uses this IP
                try:
                    other = db.query(tmodels.TEquipment).join(tmodels.TNet).filter(getattr(tmodels.TNet, 'IP') == ip_val, tmodels.TEquipment.id_equipment != bench_id).first()
                    if other:
                        raise HTTPException(status_code=400, detail=f"IP '{ip_val}' is already used by another equipment (id {other.id_equipment})")
                except HTTPException:
                    raise
                except Exception as ex:
                    raise HTTPException(status_code=500, detail=f"Could not validate IP uniqueness: {ex}")

                # 2) if T_NET row exists for this IP, link and update it
                try:
                    existing_net = db.query(tmodels.TNet).filter(getattr(tmodels.TNet, 'IP') == ip_val).first()
                except Exception as ex:
                    raise HTTPException(status_code=500, detail=f"Could not query T_NET: {ex}")

                if existing_net:
                    # update NM/GW if provided (or keep existing values)
                    if 'mask' in provided:
                        try:
                            setattr(existing_net, 'NM', provided.get('mask'))
                        except Exception:
                            pass
                    if 'gateway' in provided:
                        try:
                            setattr(existing_net, 'GW', provided.get('gateway'))
                        except Exception:
                            pass
                    db.add(existing_net)
                    # link equipment to existing net
                    try:
                        e.T_NET_id_ip = getattr(existing_net, 'id_ip', None)
                    except Exception:
                        try:
                            e.net = existing_net
                        except Exception:
                            pass
                else:
                    # 3) create a new T_NET row with provided IP and mask/gateway
                    try:
                        net = tmodels.TNet()
                        # set requested defaults for newly created network rows
                        try:
                            if hasattr(net, 'protocol'):
                                net.protocol = 'v4'
                        except Exception:
                            pass
                        try:
                            if hasattr(net, 'inUse'):
                                net.inUse = 1
                        except Exception:
                            pass
                        setattr(net, 'IP', ip_val)
                        # set NM/GW from payload if present, otherwise leave None
                        if 'mask' in provided:
                            try:
                                setattr(net, 'NM', provided.get('mask'))
                            except Exception:
                                pass
                        if 'gateway' in provided:
                            try:
                                setattr(net, 'GW', provided.get('gateway'))
                            except Exception:
                                pass
                        db.add(net)
                        db.flush()
                        try:
                            e.T_NET_id_ip = getattr(net, 'id_ip', None)
                        except Exception:
                            try:
                                e.net = net
                            except Exception:
                                pass
                    except Exception as ex:
                        raise HTTPException(status_code=500, detail=f"Could not create T_NET row: {ex}")

        # if ip not provided, but mask/gateway are provided, preserve previous behaviour of ensuring a TNet exists
        if 'ip' not in provided and ('mask' in provided or 'gateway' in provided):
            mask_val = provided.get('mask') if 'mask' in provided else None
            gw_val = provided.get('gateway') if 'gateway' in provided else None
            try:
                net = None
                if getattr(e, 'net', None):
                    net = e.net
                else:
                    net = tmodels.TNet()
                    # set requested defaults for newly created network rows
                    try:
                        if hasattr(net, 'protocol'):
                            net.protocol = 'v4'
                    except Exception:
                        pass
                    try:
                        if hasattr(net, 'inUse'):
                            net.inUse = 1
                    except Exception:
                        pass
                    if hasattr(net, 'IP') and getattr(net, 'IP', None) is None:
                        net.IP = ''
                    db.add(net)
                    db.flush()
                    try:
                        e.T_NET_id_ip = getattr(net, 'id_ip', None)
                    except Exception:
                        pass
                if mask_val is not None:
                    try:
                        setattr(net, 'NM', mask_val)
                    except Exception:
                        pass
                if gw_val is not None:
                    try:
                        setattr(net, 'GW', gw_val)
                    except Exception:
                        pass
                db.add(net)
            except Exception as ex:
                raise HTTPException(status_code=500, detail=f"Could not update network fields: {ex}")
        if 'description' in provided:
            try:
                # allow clearing description by sending null
                if provided.get('description') is None:
                    setattr(e, 'description', None)
                else:
                    setattr(e, 'description', provided.get('description'))
            except Exception:
                pass

        if 'lib_id' in provided:
            lib_val = provided.get('lib_id')
            if lib_val is None:
                try:
                    e.T_LIB_id_lib = None
                except Exception:
                    pass
            else:
                lib_row = db.query(tmodels.TLib).filter(tmodels.TLib.id_lib == lib_val).first()
                if not lib_row:
                    raise HTTPException(status_code=400, detail=f"Lib id '{lib_val}' not found")
                try:
                    e.T_LIB_id_lib = lib_val
                except Exception:
                    try:
                        e.lib = lib_row
                    except Exception:
                        pass
        db.add(e)
        db.commit()
        db.refresh(e)
        # include network info in response for frontend to update local state
        try:
            ip_out = e.net.IP if getattr(e, 'net', None) else None
            mask_out = getattr(e.net, 'NM', None) if getattr(e, 'net', None) else None
            gw_out = getattr(e.net, 'GW', None) if getattr(e, 'net', None) else None
        except Exception:
            ip_out = None
            mask_out = None
            gw_out = None
        return { 'id': e.id_equipment, 'name': e.name, 'owner': e.owner, 'brand_id': e.T_BRAND_id_brand, 'ip': ip_out, 'mask': mask_out, 'gateway': gw_out, 'description': getattr(e, 'description', None), 'lib_id': getattr(e, 'T_LIB_id_lib', None), 'lib_name': getattr(e.lib, 'lib_name', None) if getattr(e, 'lib', None) else None }
    except HTTPException:
        raise
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not update bench: {ex}")


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


@router.get('/brands')
def list_brands(db: Session = Depends(get_db)):
    """Return list of brands (id_brand, brand_name)."""
    try:
        brands = db.query(tmodels.TBrand).all()
        result = []
        for b in brands:
            result.append({'id': b.id_brand, 'name': b.brand_name})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not query brands: {e}")


@router.get('/equip-types')
def list_equip_types(db: Session = Depends(get_db)):
    """Return list of equipment types (id_type, name)."""
    try:
        types = db.query(tmodels.TEquipType).all()
        out = []
        for t in types:
            out.append({'id': t.id_type, 'name': t.equip_name if hasattr(t, 'equip_name') else getattr(t, 'name', None)})
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not query equip types: {e}")


@router.get('/libs')
def list_libs(equip_type_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """Return list of libraries (id_lib, lib_name).

    If `equip_type_id` is provided, only return libs that are associated with that equipment type
    via the T_LIB_DOMAIN table.
    """
    try:
        if equip_type_id is None:
            libs = db.query(tmodels.TLib).all()
        else:
            # join with T_LIB_DOMAIN to filter libs allowed for the given equip type
            libs = db.query(tmodels.TLib).join(tmodels.TLibDomain, tmodels.TLib.id_lib == tmodels.TLibDomain.T_LIB_id_lib).filter(tmodels.TLibDomain.T_EQUIP_TYPE_id_type == equip_type_id).all()
        out = []
        for l in libs:
            out.append({'id': l.id_lib, 'name': l.lib_name})
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not query libs: {e}")


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
