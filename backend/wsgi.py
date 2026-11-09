"""Entry point: `flask --app wsgi run` (dev) or `gunicorn wsgi:app` (production)."""

from app import create_app

app = create_app()
