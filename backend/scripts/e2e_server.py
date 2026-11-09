"""Start the API on a fresh, seeded SQLite database for the Playwright end-to-end tests.

    python scripts/e2e_server.py            # http://127.0.0.1:5001

Never touches the development database: it uses instance/e2e.db, recreated on every start.
"""

import logging
import os
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

DB_FILE = BACKEND / "instance" / "e2e.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE}"
os.environ["REPORTS_DIR"] = tempfile.mkdtemp(prefix="mediassist-e2e-reports-")
os.environ["LOGIN_RATE_LIMIT"] = "1000 per minute"
os.environ["REGISTER_RATE_LIMIT"] = "1000 per minute"
os.environ["ASSISTANT_PROVIDER"] = "rules"  # never call a paid API from tests
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5174")

from app import create_app  # noqa: E402
from app.cli import seed_database  # noqa: E402
from app.extensions import db  # noqa: E402

app = create_app("development")
with app.app_context():
    DB_FILE.parent.mkdir(exist_ok=True)
    db.drop_all()
    db.create_all()
    seed_database(demo=True)

if __name__ == "__main__":
    logging.getLogger("werkzeug").setLevel(logging.WARNING)  # keep test output readable
    port = int(os.getenv("E2E_API_PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
