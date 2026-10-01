# Zandegi codebase review scope

Content class: code.

Review the complete repository implementation for production readiness and migration suitability.

Primary canonical implementation:

- `apps/web/**`
- `packages/core/**`
- `packages/ai/**`
- `packages/celebrations/**`
- scaffold packages under `packages/api`, `packages/db`, `packages/economy`, `packages/integrations`, `packages/tools`, and `packages/ui`
- root workspace configuration and scripts

Legacy extraction source:

- `legacy/src/**`
- `legacy/prisma/**`
- `legacy/test/**`
- `legacy/package.json` and framework configuration

Review goals:

1. Find concrete correctness, security, reliability, contract, and migration defects.
2. Identify legacy capabilities worth extracting into the canonical monorepo.
3. Distinguish code that should be fixed, extracted, replaced, deferred, or deleted after migration.
4. Pay particular attention to the AI generation pipeline, unauthenticated generation endpoint, persistence boundaries, auth and ownership checks, XP/economy invariants, and test gaps.
5. Cite exact file and line locations. Do not report vague architectural preferences as defects.

Repository root: `C:/Users/SIN0119/Zandegi`
