# Contributing

Single source of truth is [`MKT_SEO_AI_SPEC.md`](./MKT_SEO_AI_SPEC.md). Any deviation requires an ADR-style note in the PR description.

## Workflow

1. Branch off `staging` (auto-deploys to staging env).
2. Use Conventional Commits with required scope (see README).
3. Open PR against `staging`. CI must be green.
4. Reference the spec section(s) implemented in the PR body.

## Definition of Done (Section 15)

A feature is only "done" when **all** of the following hold:

- [ ] Unit test coverage ≥ 80 %
- [ ] Integration test for happy path + at least one error path
- [ ] Swagger documents every new endpoint
- [ ] Frontend implemented and connected to the API
- [ ] E2E test for the primary user flow
- [ ] API p95 < 2 s for non-AI endpoints, < 90 s for AI endpoints
- [ ] All errors return an `ErrorCode` (Section 11) with a Vietnamese `message`
- [ ] Business events logged via Pino (Section 16)
- [ ] Sentry tracking enabled in production code paths
- [ ] Code review approved
- [ ] Deployed to staging, QA passes
- [ ] PRD acceptance criteria 100 % met

## Coding standards (Section 15)

- TypeScript `strict: true`. No `any` — use `unknown` if absolutely necessary.
- Interfaces for public API, types for internal.
- `PascalCase` for classes/interfaces, `camelCase` for variables/functions.
- Max line length 100, 2-space indent.
- No unused imports.
- Husky runs `prettier`, `eslint`, and `commitlint` on every commit.

## Branch model

```
main (production, protected)
  ├── staging (auto-deploy staging)
  │     ├── feature/<short-name>
  │     └── fix/<short-name>
  └── hotfix/<short-name>
```

## Tests — where things live

| Suite       | Location                       | When it runs              |
| ----------- | ------------------------------ | ------------------------- |
| Unit        | `*.spec.ts` next to source     | every `pnpm test:unit`    |
| Integration | `apps/api/test/integration/**` | needs Postgres + Redis up |
| E2E (API)   | `apps/api/test/e2e/**`         | needs full stack up       |
| E2E (Web)   | `apps/web/e2e/**` (Playwright) | needs API + Web up        |

## Adding a new feature module

1. Read the corresponding TN section in the spec.
2. Create `apps/api/src/modules/<feature>/` with controller/service/dto/test files.
3. Wire into `AppModule`.
4. Add OpenAPI tags so Swagger is grouped.
5. Add quota usage where appropriate (Section 10) and emit events on success (Section 12).
6. Add the frontend page under `apps/web/src/app/(dashboard)/<feature>/`.

## Questions / blockers

If the spec is silent or contradictory, open a discussion in the PR rather than guessing.
