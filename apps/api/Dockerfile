FROM node:26-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
WORKDIR /app
RUN pnpm --filter @myshopuz/shared run build && \
  pnpm --filter @myshopuz/api exec prisma generate --schema=/app/apps/api/prisma/schema.prisma && \
  pnpm --filter @myshopuz/api run build

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache wget postgresql-client && \
  addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=builder /app/node_modules ./node_modules
RUN chmod +x ./scripts/docker-entrypoint.sh
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health/ready >/dev/null || exit 1
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
