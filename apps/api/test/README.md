# API E2E tests

Requires PostgreSQL with migration `260301_init` and seed data.

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm run test:e2e
```

`guest-payme-flow.e2e-spec.ts` covers the full guest pay-first path:

1. Add item to anonymous cart (`x-cart-session`)
2. `POST /checkout-session/guest`
3. `POST /payments/payme/init` with `pollToken`
4. Mock Payme callbacks (`CheckPerformTransaction` → `CreateTransaction` → `PerformTransaction`)
5. Poll session for `orderId` + `guestViewToken`
6. Load order via `GET /orders/:id/guest-view`

Payme auth in tests uses `e2e-merchant` / `e2e-payme-secret-key` (set in `e2e-helpers.ts` and CI).
