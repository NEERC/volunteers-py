#!/bin/sh
# Starts the backend of the e2e stack: creates the database if needed,
# applies migrations and runs uvicorn. Run from the repository root.
# The database is never dropped, so data of previous runs stays for manual testing.
set -e

node e2e/scripts/prepare-db.mjs
.venv/bin/alembic upgrade head
exec .venv/bin/uvicorn volunteers.app:app --host 127.0.0.1 --port "$VOLUNTEERS_SERVER__PORT"
