#!/usr/bin/env bash
# Rebaseline _prisma_migrations after squashing migration folders (keeps data).
# Usage: DATABASE_URL=postgresql://... ./prisma/scripts/rebaseline-migrations.sh [migration_name]
set -euo pipefail

MIGRATION_NAME="${1:-260301_init}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Rebaselining migration history to: $MIGRATION_NAME"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM "_prisma_migrations";
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '',
  NOW(),
  '$MIGRATION_NAME',
  NULL,
  NULL,
  NOW(),
  1
);
SQL

echo "Done. Verify with: pnpm exec prisma migrate deploy"
