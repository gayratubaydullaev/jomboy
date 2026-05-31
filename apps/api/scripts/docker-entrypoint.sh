#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ] && [ "${SKIP_MIGRATE:-}" != "1" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy --schema=./prisma/schema.prisma
fi

if [ "$APPLY_RLS" = "true" ] && [ -n "$DATABASE_URL" ]; then
  if command -v psql >/dev/null 2>&1 && [ -f ./prisma/rls-policies.sql ]; then
    echo "[entrypoint] Applying RLS policies..."
    psql "$DATABASE_URL" -f ./prisma/rls-policies.sql
  else
    echo "[entrypoint] APPLY_RLS=true but psql or rls-policies.sql missing; skipping"
  fi
fi

exec node dist/src/main.js
