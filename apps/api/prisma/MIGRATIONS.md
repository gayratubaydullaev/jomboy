# Migrations

One migration folder: **`260301_init`** — full schema from `schema.prisma`.

## New database

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

## Already used the old 4 migrations

Prisma tracks applied migrations in `_prisma_migrations`. After squashing you must either:

**Option A — development (data can be lost)**

```bash
pnpm exec prisma migrate reset
```

**Option B — keep data, rebaseline (production-style)**

1. Backup the database.
2. Ensure the live schema matches `schema.prisma` (or run the SQL in `260301_init/migration.sql` manually for any missing pieces).
3. Run the rebaseline script (from `apps/api`):

```bash
# Linux/macOS
DATABASE_URL="postgresql://..." ./prisma/scripts/rebaseline-migrations.sh

# Windows PowerShell
$env:DATABASE_URL="postgresql://..."
.\prisma\scripts\rebaseline-migrations.ps1
```

4. `pnpm exec prisma migrate deploy` should report nothing pending.

## Production Docker

The API image runs `prisma migrate deploy` on container start (see `scripts/docker-entrypoint.sh`).
Set `SKIP_MIGRATE=1` only if you run migrations separately in CI/CD.

Then optionally: `pnpm exec prisma/apply-rls.sh`
