# MKT SEO AI

Multi-tenant SaaS for the end-to-end SEO pipeline: keyword research → AI content generation in brand voice → automatic WordPress publishing.

> Source of truth: [`MKT_SEO_AI_SPEC.md`](./MKT_SEO_AI_SPEC.md). Every technical decision references a section in that file.

---

## Stack

| Layer     | Tech                                                               |
| --------- | ------------------------------------------------------------------ |
| Monorepo  | pnpm workspaces + Turborepo                                        |
| Backend   | NestJS 10 + TypeScript strict, Prisma 5, BullMQ                    |
| Frontend  | Next.js 15 (App Router) + TailwindCSS + shadcn/ui                  |
| Datastore | PostgreSQL 16 + Redis 7                                            |
| AI        | Anthropic Claude (Sonnet 4 + Haiku), OpenAI GPT-4o, Replicate Flux |

Full stack: spec Section 4.

---

## Folder layout (Section 4)

```
apps/
  api/        NestJS backend (port 3005)
  web/        Next.js frontend (port 3006)
packages/
  shared/     Cross-app types + constants
  database/   Prisma schema + client (Section 7 — 16 tables)
  ui/         Shared shadcn/ui components
  config/     Shared eslint / prettier / tsconfig
```

---

## Quick start

Prereqs: Node 20 LTS, pnpm 9, Docker Desktop, Git.

```bash
# 1. Install deps (uses workspaces — pnpm install at root is enough)
pnpm install

# 2. Bring up Postgres + Redis (Section 14)
cp .env.example .env
docker compose up -d postgres redis

# 3. Generate Prisma client + run migrations + seed admin user
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. Run everything
pnpm dev
```

Then:

- Web UI: <http://localhost:3006>
- API: <http://localhost:3005/api/v1>
- Swagger: <http://localhost:3005/docs>
- Prisma Studio: `pnpm db:studio` → <http://localhost:5555>
- Postgres: `localhost:5434` (avoids clash with other dev Postgres on 5432/5433)
- Redis: `localhost:6380` (avoids clash with other dev Redis on 6379)

Default seeded admin: `admin@mkt-seo.local` / `Admin@12345` (change immediately in any shared env).

---

## Common scripts

| Command                 | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `pnpm dev`              | Run API + Web in watch mode (Turborepo orchestrated) |
| `pnpm build`            | Build all packages and apps                          |
| `pnpm lint`             | ESLint across the monorepo                           |
| `pnpm test`             | All Jest suites                                      |
| `pnpm test:unit`        | Unit only (fast, no DB)                              |
| `pnpm test:integration` | Integration (needs Postgres + Redis up)              |
| `pnpm format`           | Prettier write                                       |
| `pnpm db:migrate`       | Apply Prisma migrations (dev)                        |
| `pnpm db:seed`          | Seed admin user                                      |
| `pnpm db:studio`        | Open Prisma Studio                                   |
| `pnpm db:reset`         | Drop + recreate + migrate + seed (destructive)       |

---

## Conventional Commits (Section 15)

`<type>(<scope>): <subject>` — scope required. Husky + commitlint will reject malformed commits.

```
feat(auth): add refresh token rotation
fix(keywords): handle empty Bing response
docs(spec): clarify intent classifier fallback
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `style`, `revert`.

---

## Architecture principles (Section 2)

1. API-First — every feature exposed as REST endpoint
2. Modular — one NestJS module per feature
3. Plugin-Ready — adapter pattern for publishers, AI providers, audit rules
4. Event-Driven — modules communicate via Redis Pub/Sub, never directly
5. Multi-tenant — every record has `user_id`, every query filters on it
6. Webhook-Ready — outgoing webhooks exposed from MVP
7. i18n-Ready — default `vi-VN`, ready for `en-US`
8. Domain via ENV — no hard-coded URLs

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
