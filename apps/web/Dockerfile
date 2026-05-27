# Production Dockerfile for apps/web.
# Multi-stage build: install workspace deps, build Next.js, then run next start.

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
RUN HUSKY=0 pnpm install --frozen-lockfile --prod=false

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

ENV NODE_ENV=production
RUN pnpm --filter @mkt-seo/shared build \
 && pnpm --filter @mkt-seo/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN addgroup -S app && adduser -S app -G app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
RUN HUSKY=0 pnpm install --frozen-lockfile --prod=false

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/apps/web/src/i18n ./apps/web/src/i18n
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/ui ./packages/ui

USER app
EXPOSE 3006
CMD ["pnpm", "--filter", "@mkt-seo/web", "start"]
