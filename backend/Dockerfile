# MediAssist API image. Build from the repository root (the API needs ml/ for the models):
#   docker build -f backend/Dockerfile -t mediassist-api .
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first (cached unless requirements change)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Shared ML package, trained models and the small raw datasets (used by `flask seed --demo`)
COPY ml/pyproject.toml ml/pyproject.toml
COPY ml/src ml/src
COPY ml/models ml/models
COPY ml/data/raw ml/data/raw
RUN pip install --no-deps ./ml

COPY backend backend
RUN chmod +x backend/docker-entrypoint.sh \
    && useradd --create-home --uid 10001 app \
    && mkdir -p backend/instance backend/generated_reports \
    && chown -R app:app backend/instance backend/generated_reports

USER app
WORKDIR /app/backend
ENV FLASK_APP=wsgi \
    FLASK_ENV=production \
    MODELS_DIR=/app/ml/models

EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=4)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--access-logfile", "-", "wsgi:app"]
