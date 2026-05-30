# Rebaseline _prisma_migrations after squashing (keeps data).
# Usage: $env:DATABASE_URL="postgresql://..."; .\prisma\scripts\rebaseline-migrations.ps1 [migration_name]
param(
  [string]$MigrationName = "260301_init"
)

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

$sql = @"
DELETE FROM "_prisma_migrations";
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '',
  NOW(),
  '$MigrationName',
  NULL,
  NULL,
  NOW(),
  1
);
"@

Write-Host "Rebaselining migration history to: $MigrationName"
$sql | psql $env:DATABASE_URL -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Verify with: pnpm exec prisma migrate deploy"
