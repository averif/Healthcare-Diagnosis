#!/bin/sh
# Apply database migrations (and optionally seed demo data) before starting the API.
set -e

echo "Applying database migrations..."
flask db upgrade

if [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "Seeding demo accounts and sample predictions..."
  flask seed --demo
fi

exec "$@"
