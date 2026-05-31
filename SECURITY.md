# Security remediation notes

## Production environment (required)

- `JWT_SECRET` (≥32 chars) — same value on API and Web
- `SESSION_COOKIE_SECRET` (≥32 chars) — Web middleware session cookie
- `CSRF_SECRET` (≥32 chars) — API
- `CLICK_ALLOWED_IPS` — comma-separated Click callback IPs
- `PAYME_ALLOWED_IPS` — comma-separated Payme callback IPs
- `THROTTLE_USE_REDIS=true` and `REDIS_URL` — API rate limiting in cluster

## Breaking changes (deploy)

1. **Refresh tokens** — stored as SHA-256 hashes; existing sessions are invalidated (users must log in again).
2. **Session cookie** — `POST /api/auth/session` requires valid `Authorization: Bearer` JWT; body `userId`/`role` is ignored.
3. **Guest re-checkout** — existing guest accounts are reused without profile overwrite; non-guest email collision returns 403.

## Manual smoke checks

- `curl -X POST http://localhost:3000/api/auth/session -H "Content-Type: application/json" -d '{"userId":"x","role":"ADMIN"}'` → 403 or 401
- `curl -X POST http://localhost:3000/api/auth/session -H "Authorization: Bearer <valid-jwt>"` → 200 + Set-Cookie
- Unmoderated product by ID → 404
- Login `?next=//evil.com` → redirects to `/`

## Post-deploy SQL (refresh token hash migration)

```bash
psql $DATABASE_URL -f apps/api/scripts/purge-refresh-tokens.sql
```

## Pre-release checklist

### Security

- [ ] `pnpm audit:check` — no high severity in runtime dependencies
- [ ] Production `.env` has all required secrets (see above)
- [ ] `prisma db seed` is **not** run in production (`NODE_ENV=production` blocks seed)
- [ ] Payment callback IP allowlists (`CLICK_ALLOWED_IPS`, `PAYME_ALLOWED_IPS`) are current

### Tests

- [ ] `pnpm test:unit` — green
- [ ] API e2e job green in CI (or `pnpm --filter @myshopuz/api test:e2e` locally with DB)
- [ ] Manual smoke: login, checkout, admin panel, Telegram Web App

### Deploy

- [ ] `pnpm db:migrate:deploy` applied (or API container entrypoint migrate)
- [ ] `BUILD_ID` / `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` set for Web Docker build
- [ ] `GET /health/ready` returns 200 (API)
- [ ] `GET /` returns 200 (Web container or PM2)
- [ ] Rollback image tag noted before deploy (`scripts/deploy-rollback.sh`)
- [ ] Optional: `APPLY_RLS=true` on first deploy after RLS policy changes
