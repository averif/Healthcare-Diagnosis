# Backend (Flask API)

From the repository root (one shared virtualenv for `backend/` and `ml/`):

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows (use `source .venv/bin/activate` on macOS/Linux)
pip install -r backend/requirements-dev.txt -e ml   # -e ml installs the shared medml package
```

Then from `backend/`:

```bash
cp .env.example .env
flask db upgrade                  # create / migrate the database
flask seed --demo                 # demo accounts + ~60 realistic sample predictions
flask run                         # http://127.0.0.1:5000  — Swagger UI at /api/docs
pytest --cov                      # tests + coverage
ruff check . && ruff format --check .
```

SQLite is used by default. Set `DATABASE_URL` in `.env` to use MySQL.

**AI assistant:** works offline out of the box (rule-based answers). With `NVIDIA_API_KEY` set
(in `backend/.env` or the project-root `.env`) it uses NVIDIA Nemotron; with `ANTHROPIC_API_KEY`
it uses Claude. Restart the API after changing keys. `ASSISTANT_MODEL` picks the model
(default `claude-opus-5-5`; `claude-haiku-5-5` is far cheaper for a demo).

Demo accounts (`flask seed`): `admin@mediassist.test`, `doctor@mediassist.test`,
`doctor2@mediassist.test`, `patient@mediassist.test` (password: `DEMO_PASSWORD` in `.env`).

## Layout

| Path | Contents |
|---|---|
| `app/api/` | Blueprints: auth, patients, predictions + reports, dashboard + models, admin |
| `app/services/predictor.py` | Loads the trained models once and stores explained predictions |
| `app/services/guidance.py` | General guidance, red-flag rules and symptom triage |
| `app/services/reports.py` | ReportLab PDF reports with QR-coded report IDs |
| `app/security.py` | JWT wiring, `roles_required`, record-level access rules, audit helper |
| `app/schemas.py` | Marshmallow request/response schemas (also generate the Swagger docs) |
| `app/services/assistant.py` | AI clinical assistant: emergency screen, Claude provider, offline rules fallback |
| `tests/` | 49 API tests (pytest), ~97% coverage; the assistant is tested with a fake Claude client |
