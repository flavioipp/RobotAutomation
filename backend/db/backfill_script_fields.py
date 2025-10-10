"""Backfill script metadata (description, topology, author) by reparsing repo files.
Usage:
  python backend/db/backfill_script_fields.py
This will iterate repos and scripts recorded in DB and re-run parse_docstrings on each file, updating DB columns.
"""
import sys
from pathlib import Path

# Ensure project root is on sys.path so `backend` package can be imported
repo_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo_root))

from backend.db.session import SessionLocal
from backend.db.models import Repo, Script
from backend.gitmanager.service import parse_docstrings

def backfill():
    db = SessionLocal()
    try:
        repos = db.query(Repo).all()
        for r in repos:
            print(f"Processing repo: {r.name}")
            scripts = db.query(Script).filter(Script.repo_id == r.id).all()
            for s in scripts:
                p = Path(s.path)
                if not p.exists():
                    print(f"  File missing: {s.path}")
                    continue
                parsed = parse_docstrings(p)
                s.description = parsed.get('description')
                s.topology = parsed.get('topology')
                s.author = parsed.get('author')
                db.commit()
                print(f"  Updated {s.filename}: desc={'Y' if s.description else 'N'}, topology={s.topology}, author={s.author}")
    finally:
        db.close()

if __name__ == '__main__':
    backfill()
