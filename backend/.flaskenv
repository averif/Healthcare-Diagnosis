# Read by the `flask` command only (not by gunicorn in production).
FLASK_APP=wsgi
# Development: restart automatically when code changes, so a long-running
# `flask run` never serves stale code.
FLASK_DEBUG=1
