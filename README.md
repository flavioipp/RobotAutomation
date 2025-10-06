# RobotAutomation - FASTAPI Backend and React front

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
