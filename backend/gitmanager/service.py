import ast
import json
from pathlib import Path
import re
from git import Repo as GitRepo
from sqlalchemy.orm import Session
from backend.db.models import Repo, Script
from datetime import datetime

from pathlib import Path
from backend.core.config import settings

def clone_or_pull(db, name: str, url: str, branch: str = "main"):
    local_path = Path('%s/%s' % (settings.REPOS_BASE_PATH,name))
    local_path.parent.mkdir(parents=True, exist_ok=True)

    if local_path.exists():
        repo = GitRepo(local_path)
        origin = repo.remotes.origin
        #origin.fetch()
        repo.git.checkout(branch)
        #origin.pull()
    else:
        repo = GitRepo.clone_from(url, local_path, branch=branch)

    # registra o aggiorna Repo nel DB
    db_repo = db.query(Repo).filter(Repo.name == name).first()
    if not db_repo:
        db_repo = Repo(name=name, url=url, branch=branch, local_path=local_path)
        db.add(db_repo)
    db_repo.last_sync = datetime.utcnow()
    db.commit()
    db.refresh(db_repo)

    # scansione script .py
    scripts = []
    for pyfile in Path(local_path).rglob("*.py"):
        parsed = parse_docstrings(pyfile)
        db_script = db.query(Script).filter(Script.repo_id == db_repo.id, Script.path == str(pyfile)).first()
        if not db_script:
            db_script = Script(repo_id=db_repo.id, path=str(pyfile), filename=pyfile.name)
            db.add(db_script)
        db_script.module_doc = parsed.get("module_doc")
        db_script.description = parsed.get("description")
        db_script.topology = parsed.get("topology")
        db_script.author = parsed.get("author")
        db_script.functions_doc = json.dumps(parsed.get("functions"))
        db.commit()
        db.refresh(db_script)
        scripts.append(db_script)
    return db_repo, scripts

def parse_docstrings(file_path: Path) -> dict:
    try:
        src = file_path.read_text(encoding="utf-8")
        mod = ast.parse(src)
        module_doc = ast.get_docstring(mod) or ""

        # attempt to extract fields from module_doc. Support patterns like:
        # :field Description: some text
        # Description: some text
        # :field Topology: X
        # Author: Name
        def extract_field(doc: str, names):
            if not doc:
                return None
            for name in names:
                # pattern with :field Name: value
                m = re.search(rf"[:]?field\s+{re.escape(name)}\s*:\s*(.+)", doc, flags=re.IGNORECASE)
                if m:
                    return m.group(1).strip()
                # pattern with Name: value
                m = re.search(rf"^{re.escape(name)}\s*:\s*(.+)$", doc, flags=re.IGNORECASE | re.MULTILINE)
                if m:
                    return m.group(1).strip()
            return None

        description = extract_field(module_doc, ["Description", "description", "Desc"])
        topology = extract_field(module_doc, ["Topology", "topology"])
        author = extract_field(module_doc, ["Author", "author"])

        functions = []
        for node in mod.body:
            if isinstance(node, ast.FunctionDef):
                functions.append({
                    "name": node.name,
                    "doc": ast.get_docstring(node)
                })
        return {
            "module_doc": module_doc,
            "description": description,
            "topology": topology,
            "author": author,
            "functions": functions
        }
    except Exception as e:
        return {"module_doc": None, "description": None, "topology": None, "author": None, "functions": []}
