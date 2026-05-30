# PostgreSQL backup for MyShopUZ.
# Usage: $env:DATABASE_URL="postgresql://..."; .\scripts\backup-db.ps1 [output_dir]
param(
  [string]$OutDir = ".\backups"
)

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$file = Join-Path $OutDir "myshopuz-$stamp.sql.gz"

Write-Host "Writing $file"
& pg_dump $env:DATABASE_URL --no-owner --no-acl | gzip -9 | Set-Content -Path $file -Encoding Byte
Write-Host "Backup complete: $file"
