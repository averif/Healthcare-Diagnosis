# Backend (Flask API)

From the repository root (one shared virtualenv for `backend/` and `ml/`):

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows (use `source .venv/bin/activate` on macOS/Linux)
pip install -r backend/requirements-dev.txt
```

Then from `backend/`:

```bash
cp .env.example .env
flask db upgrade                  # create / migrate the database
flask seed                        # demo admin, doctor and patient accounts
flask run                         # http://127.0.0.1:5000  — Swagger UI at /api/docs
pytest --cov                      # tests + coverage
ruff check . && ruff format --check .
```

SQLite is used by default. Set `DATABASE_URL` in `.env` to use MySQL.
