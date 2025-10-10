#!/bin/sh
set -e

host="${DATABASE_HOST:-db}"
port="${DATABASE_PORT:-3306}"

echo "Waiting for database at $host:$port..."
until nc -z $host $port; do
  sleep 1
done

echo "Database available — creating tables (if needed)"
python create_tables.py

echo "Starting Uvicorn"
uvicorn app.main:app --host 0.0.0.0 --port 8000
