# MediAssist CDSS

**AI-Powered Healthcare Diagnosis and Clinical Decision Support System**
B.Tech CSE final-year project, Integral University Lucknow (2026–27).
Team: Zibran Hasan Khan · Tanvir Husain · Yasir Khan. Supervisor: Ms. Saman Khan.

MediAssist gives **preliminary, explainable** predictions for Diabetes, Heart Disease, Liver Disease
and symptom-based conditions using Decision Tree models. It adds patient history, doctor review,
PDF reports, role-based dashboards and an AI clinical assistant.

> ⚠️ Decision support only. This is not a medical diagnosis and does not replace a qualified clinician.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form + Zod, Recharts |
| Backend | Python, Flask 3, flask-smorest (OpenAPI), SQLAlchemy 2 + Alembic, Flask-JWT-Extended, Argon2, ReportLab |
| AI assistant | Claude via the Anthropic Python SDK (optional), with an offline rule-based fallback |
| ML | scikit-learn (Decision Trees; Random Forest for symptoms), pandas, NumPy, joblib, Jupyter |
| Database | SQLite (development) / MySQL (deployment) |
| Quality | pytest, Vitest, React Testing Library, Ruff, oxlint, Prettier, GitHub Actions |

## Project phases

| Phase | Weeks | Scope | Status |
|---|---|---|---|
| 1. Foundation & design | 1–2 | Repo, scaffolds, requirements, architecture, database schema, datasets | ✅ Done |
| 2. ML pipeline | 3–5 | Exploratory analysis, preprocessing, Decision Tree tuning, evaluation, model cards, explainer | ✅ Done |
| 3. Backend API | 6–7 | Auth / RBAC, patients, predictions, reviews, PDF reports, dashboard, audit log | ✅ Done |
| 4. Frontend & assistant | 8–9 | All pages, dashboards, model performance page, AI clinical assistant | ✅ Done |
| 5. Test, deploy, document | 10–12 | E2E tests, Docker, deployment, final report, presentation | ⏳ |

## Quick start

```bash
# 1. Python environment (shared by backend and ml)
python -m venv .venv
.venv/Scripts/activate                 # macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements-dev.txt -e ml
python ml/scripts/download_data.py     # fetch and verify datasets
python -m medml.train                  # optional: retrain models (trained models are committed)

# 2. Backend (http://127.0.0.1:5000, Swagger UI at /api/docs)
cd backend
cp .env.example .env
flask db upgrade && flask seed --demo   # demo accounts + ~60 sample predictions
flask run

# 3. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

## Documentation

1. [Requirements specification](docs/01-requirements.md)
2. [System architecture and diagrams](docs/02-architecture.md)
3. [Database design (ER diagram)](docs/03-database-design.md)
4. [Datasets and data-quality findings](docs/04-datasets.md)
5. [REST API design](docs/05-api-design.md)
6. [Model development and evaluation](docs/06-model-evaluation.md)
7. [Frontend and AI assistant](docs/07-frontend-and-assistant.md)
