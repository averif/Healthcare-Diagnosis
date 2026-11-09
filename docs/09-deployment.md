# 9. Deployment

Three ways to run MediAssist, from simplest to most production-like.

## 9.1 Local development (SQLite)

See the [README quick start](../README.md#quick-start). Two terminals: `flask run` (API on
:5000) and `npm run dev` (web on :5173, proxying `/api`).

## 9.2 Docker Compose (MySQL, production configuration)

```mermaid
flowchart LR
    B([Browser]) -->|":8080"| N["frontend<br/>nginx: React build,<br/>security headers"]
    N -->|"/api/*"| G["backend<br/>gunicorn: 2 workers × 4 threads<br/>Flask + models"]
    G --> M[("db<br/>MySQL 8.4")]
    G --> V[["reports volume"]]
    M --> W[["db-data volume"]]
```

```bash
cp .env.example .env
# fill in SECRET_KEY, JWT_SECRET_KEY, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD (and DEMO_PASSWORD)
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
docker compose up --build
```

Open <http://localhost:8080>. The API documentation is at <http://localhost:8080/api/docs>.

What happens on start:

1. **db** starts MySQL and reports healthy once it accepts connections.
2. **backend** waits for the database, runs `flask db upgrade` (the same Alembic migrations as
   SQLite) and, if `SEED_DEMO=1`, seeds demo data. It then starts gunicorn as a non-root user,
   with a container health check on `/api/health`.
3. **frontend** waits for a healthy API, then serves the built SPA through nginx. It adds security
   headers (CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy), gzip,
   long-lived caching for fingerprinted assets and an SPA fallback, and proxies `/api`.

Useful commands:

```bash
docker compose logs -f backend             # API logs
docker compose exec backend flask seed --demo
docker compose down                        # stop (data kept in volumes)
docker compose down -v                     # stop and DELETE the database
```

> Allow roughly 2–3 GB of free disk for the three images (the API image carries scikit-learn and
> pandas; MySQL is the largest). CI builds both application images on every push.

## 9.3 Cloud hosting (optional live demo link)

Any container platform works. A free-tier-friendly combination:

| Part | Service | Settings |
|---|---|---|
| Database | Aiven / Railway MySQL, or Neon Postgres* | Copy the connection URL into `DATABASE_URL` |
| API | Render or Railway (Docker) | Dockerfile `backend/Dockerfile`, build context = repo root; env vars from §9.4 |
| Web | Vercel / Netlify (static) | Root `frontend`, build `npm run build`, output `dist`; set `VITE_API_BASE_URL` to the API URL + `/api`, and add that origin to the API's `CORS_ORIGINS` |

\* PostgreSQL also works with SQLAlchemy (`postgresql+psycopg://…`, add `psycopg[binary]`). The
synopsis specifies SQLite/MySQL, so MySQL is the documented target.

## 9.4 Configuration reference

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `FLASK_ENV` | API | `development` | `production` enables the secret checks below |
| `SECRET_KEY`, `JWT_SECRET_KEY` | API | dev values | **Required in production**: at least 32 random characters; the app refuses to start otherwise |
| `DATABASE_URL` | API | SQLite file | `mysql+pymysql://user:pass@host:3306/db?charset=utf8mb4` |
| `CORS_ORIGINS` | API | `http://localhost:5173` | Comma-separated allowed web origins |
| `BEHIND_PROXY` | API | `0` | `1` behind nginx or a load balancer, so rate limits and audit logs use the real client IP |
| `LOGIN_RATE_LIMIT`, `REGISTER_RATE_LIMIT` | API | `10 per minute`, `5 per minute` | Brute-force protection |
| `RATELIMIT_STORAGE_URI` | API | `memory://` | Use `redis://…` to share limits across gunicorn workers |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | API | `30`, `7` | Token lifetimes |
| `ASSISTANT_PROVIDER` | API | `auto` | `auto`, `claude` or `rules` |
| `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL` | API | unset, `claude-opus-5-5` | Optional Claude assistant |
| `SEED_DEMO`, `DEMO_PASSWORD` | Docker | `0`, `Demo@12345` | Demo data on first start |
| `MODELS_DIR`, `REPORTS_DIR` | API | `ml/models`, `backend/generated_reports` | Model and PDF locations |
| `VITE_API_BASE_URL` | Web build | `/api` | API URL when hosted separately |

## 9.5 Production checklist

- [ ] Strong, unique `SECRET_KEY` and `JWT_SECRET_KEY` (the app enforces this)
- [ ] HTTPS in front of the web app (platform TLS or a reverse proxy)
- [ ] `CORS_ORIGINS` set to the real web origin only
- [ ] `BEHIND_PROXY=1` when behind a proxy
- [ ] Shared rate-limit storage (Redis) if running more than one API instance
- [ ] Database backups (managed service snapshots, or `mysqldump` on a schedule)
- [ ] `SEED_DEMO=0` and demo accounts removed for anything beyond a demo
- [ ] Anthropic API key stored as a platform secret (never in Git)
- [ ] Remember: this is a **prototype**. Real clinical use would need regulatory approval,
      clinical validation and data-protection compliance (e.g. India's DPDP Act 2023).
