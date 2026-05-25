## Summary

<!-- 1-3 bullets describing what changed and why. Reference the spec section(s) implemented. -->

## Spec coverage

- Section X.Y — …

## Test plan

- [ ] Unit tests added/updated (`pnpm test:unit`)
- [ ] Integration tests added/updated (`pnpm test:integration`)
- [ ] Tested manually (link to Loom or steps)
- [ ] Swagger updated (any new endpoint must appear in `/docs`)

## Checklist (Section 15 — Definition of Done)

- [ ] TypeScript strict, no `any`
- [ ] Error responses use `ErrorCode` enum, Vietnamese message
- [ ] Business events logged via Pino
- [ ] `pnpm lint` passes with zero warnings
- [ ] Sprint commits are Conventional Commits (`<type>(<scope>): subject`)
