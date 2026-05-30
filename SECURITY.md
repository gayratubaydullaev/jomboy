# Security remediation notes

## Production environment (required)

- `JWT_SECRET` (≥32 chars) — same value on API and Web
- `SESSION_COOKIE_SECRET` (≥32 chars) — Web middleware session cookie
- `CSRF_SECRET` (≥32 chars) — API
- `CLICK_ALLOWED_IPS` — comma-separated Click callback IPs
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
