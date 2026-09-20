#!/bin/sh
set -e

HOST="${1:-postgres}"
PORT="${2:-5432}"

until pg_isready -h "$HOST" -p "$PORT" >/dev/null 2>&1; do
  echo "PostgreSQL is not ready yet at $HOST:$PORT..."
  sleep 2
done

echo "PostgreSQL is ready at $HOST:$PORT."
