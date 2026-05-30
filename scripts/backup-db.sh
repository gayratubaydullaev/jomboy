#!/usr/bin/env bash
# PostgreSQL backup for MyShopUZ deploy stack.
# Usage: DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-db.sh [output_dir]
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/myshopuz-${STAMP}.sql.gz"

echo "Writing $FILE"
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$FILE"
echo "Backup complete: $FILE"
