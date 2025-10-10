"""Run this script to add new columns to the `scripts` table if they don't exist.
Usage:
  python backend/db/migrate_add_script_fields.py
It uses SQLAlchemy engine configured in `backend/db/session.py`.
"""
from sqlalchemy import inspect, text
import sys
from pathlib import Path
from datetime import datetime

# Ensure project root is on sys.path so `backend` package can be imported
repo_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo_root))

from backend.db.session import engine

def ensure_columns():
    inspector = inspect(engine)
    if 'scripts' not in inspector.get_table_names():
        print("Table 'scripts' does not exist. Create tables first (create_tables.py).")
        return
    cols = [c['name'] for c in inspector.get_columns('scripts')]
    stmts = []
    if 'description' not in cols:
        stmts.append("ALTER TABLE scripts ADD COLUMN description TEXT")
    if 'topology' not in cols:
        stmts.append("ALTER TABLE scripts ADD COLUMN topology VARCHAR(255)")
    if 'author' not in cols:
        stmts.append("ALTER TABLE scripts ADD COLUMN author VARCHAR(255)")

    if not stmts:
        print('No changes needed. Columns already present.')
        return

    # Create a timestamped backup table before applying schema changes.
    # This creates a copy of the current `scripts` table so you can inspect or restore
    # data if something goes wrong. The backup table name includes UTC timestamp.
    ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    backup_table = f"scripts_backup_{ts}"
    backup_stmt = f"CREATE TABLE {backup_table} AS SELECT * FROM scripts"
    print(f"Creating backup table '{backup_table}' before applying migration...")
    with engine.begin() as conn:
        try:
            conn.execute(text(backup_stmt))
            print(f"Backup table '{backup_table}' created.")
        except Exception as e:
            # If backup fails, warn and continue cautiously (do not abort the script automatically).
            # The operation below will still attempt the ALTERs; you can re-run this script after fixing backup.
            print(f"Warning: failed to create backup table: {e}")
            print("Proceeding to run ALTER statements (make sure you have a copy of your DB).")

    with engine.begin() as conn:
        for s in stmts:
            print('Executing:', s)
            conn.execute(text(s))
    print('Migration complete.')

if __name__ == '__main__':
    ensure_columns()
