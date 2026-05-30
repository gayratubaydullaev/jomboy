#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ] && [ "${SKIP_MIGRATE:-}" != "1" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  npx prisma migrate deploy --schema=./prisma/schema.prisma
fi

exec node dist/src/main.js
