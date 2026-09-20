#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
./infrastructure/docker/wait-for-postgres.sh postgres 5432

echo "Applying database schema with Drizzle..."
pnpm db:push

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "Seeding demo data..."
  pnpm db:seed
else
  echo "Skipping demo seed because SEED_ON_START is false."
fi

echo "Starting MansaMart API on 0.0.0.0:${PORT:-5000}..."
pnpm dev:api
