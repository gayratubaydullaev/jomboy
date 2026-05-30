#!/usr/bin/env sh
# Apply Row Level Security policies after migrations.
# Usage: DATABASE_URL=postgresql://... sh prisma/apply-rls.sh
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi
psql "$DATABASE_URL" -f "$(dirname "$0")/rls-policies.sql"
echo "RLS policies applied."
