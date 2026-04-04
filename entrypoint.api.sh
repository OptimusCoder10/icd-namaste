#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432 2>/dev/null; do
  echo "Postgres not ready yet, retrying in 2s..."
  sleep 2
done
sleep 1

echo "Running database migrations..."
cd /app/lib/db && pnpm run push
cd /app

echo "Starting API server..."
exec pnpm --filter @workspace/api-server run dev
