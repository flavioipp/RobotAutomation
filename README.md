# K@TE (RobotAutomation) - FASTAPI Backend and React front

Quick notes to get the backend running locally.

Prereqs

- Python 3.10+ and a virtualenv
- MySQL server (or change `DATABASE_URL` to another supported DB)

Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `.env` in the repo root (see `.github/copilot-instructions.md` for example).

Create DB tables and an admin user:

```bash
python create_tables.py
python create_admin.py
```

Run server (dev):

```bash
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/ and http://localhost:8000/docs for the OpenAPI UI.

Troubleshooting

- If `create_tables.py` fails, verify `DATABASE_URL` and DB connectivity.
- If JWT issues appear, confirm `SECRET_KEY` is set and consistent between services.

Migrations (adding script fields)
-------------------------------

This repository includes a simple migration script that will add three new columns
to the `scripts` table: `description` (TEXT), `topology` (VARCHAR(255)), and
`author` (VARCHAR(255)). The migration script also creates a timestamped backup
table before applying schema changes so you can inspect or restore data if needed.

Safe run instructions:

```bash
# from repo root
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# create tables if you haven't yet
python create_tables.py

# run the migration (this will create a backup table named scripts_backup_YYYYMMDD_HHMMSS)
python backend/db/migrate_add_script_fields.py

# after migration, run backfill to populate the new columns from parsed docstrings
python backend/db/backfill_script_fields.py
```

Notes & warnings
- Always back up your production database before running schema migrations.
- The migration script creates a copy of the `scripts` table (see `backend/db/migrate_add_script_fields.py`).
- For production systems consider using Alembic for versioned, repeatable migrations. If you'd like, I can add an Alembic revision to this repo.
