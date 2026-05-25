# Section 14 — production Dockerfile for apps/api.
# Multi-stage: build with full deps, ship a slim runtime image.

# ---------- 1. deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# Copy lockfile + workspace manifests so pnpm can install deterministically.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# ---------- 2. build ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# Generate Prisma client + build shared types + compile API.
RUN pnpm --filter @mkt-seo/database generate \
 && pnpm --filter @mkt-seo/shared build \
 && pnpm --filter @mkt-seo/api build

# ---------- 3. runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# Add a non-root user.
RUN addgroup -S app && adduser -S app -G app
# Production deps only — install from lockfile, then prune to reduce image size.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --prod --frozen-lockfile
# Built artefacts from builder stage.
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER app
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3005/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
