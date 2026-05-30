#!/usr/bin/env bash
# Export OpenAPI JSON from a running API (default http://127.0.0.1:4000).
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
OUT="${1:-docs/openapi.json}"
mkdir -p "$(dirname "$OUT")"

curl -fsS "${API_URL%/}/api/docs-json" -o "$OUT"
echo "OpenAPI written to $OUT"
