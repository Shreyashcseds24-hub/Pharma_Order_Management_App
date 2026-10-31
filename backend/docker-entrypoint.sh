#!/bin/sh
# Production entrypoint: apply safe, forward-only migrations, then start Gunicorn.
# Demo data is never loaded automatically. Run `flask --app run.py seed` manually
# if you are intentionally creating a development/demo environment.
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Applying database migrations..."
    if ! flask --app run.py db upgrade; then
        echo "FATAL: database migrations failed. The application will not start." >&2
        echo "Check DATABASE_URL, database availability and migration logs above." >&2
        exit 1
    fi
    echo "Database migrations applied."
else
    echo "RUN_MIGRATIONS is disabled; skipping migrations."
fi

exec "$@"
