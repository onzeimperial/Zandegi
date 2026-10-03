---
title: 'Story 1.1 — Establish a Reproducible Supported Workspace'
type: 'chore'
created: '2026-10-03'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd403b28f16eb8fc0f4873368dd7b0e603a030b22'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current workspace advertises loose Node and pnpm ranges, CI runs Node 22 with pnpm 12.3.4, package manifests contain divergent dependency ranges, and `pnpm-lock.yaml` combines two YAML documents. A fresh checkout therefore cannot reproduce the reviewed foundation without relying on local tooling or accidental resolution state.

**Approach:** Align the current pnpm workspace on Node 24 LTS, Corepack-activated pnpm 12.8.2, exact reviewed dependency pins, and one regenerated single-document workspace lockfile. Prove frozen clean installation and the existing typecheck/test surface, and record the reviewed dependency delta honestly.

## Boundaries & Constraints

**Always:** Keep `apps/*` and `packages/*` as the pnpm workspace; activate the package manager through Corepack; pin direct dependencies exactly; use Node 24 in current-workspace CI; converge shared schemas on Zod 4.6.5; retain the reviewed Next 15 line; record lockfile changes in `docs/BUILD-LOG.md`; preserve user-owned dirty planning changes.

**Never:** Delete or absorb `legacy/`, rewrite its independent npm lock, or import legacy code; migrate to Next 16, TypeScript 7, or another unapproved major; implement Prisma persistence, tRPC routes, Inngest behavior, API-boundary repair, environment cleanup, legacy-import enforcement, or Story 1.2's aggregate verification/build guardrails.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh install | Node 24 checkout, no global pnpm, empty install state | Corepack activates pnpm 12.8.2 and `pnpm install --frozen-lockfile` succeeds | Any package-manager or lock drift fails non-zero |
| Repeated install | Same manifests and committed lock after removing install artifacts | Dependency graph is unchanged | Frozen install rejects mutation or unresolved ranges |
| Existing checks | Repaired install with no provider credentials | Current package typechecks and deterministic tests run | Existing application failures are reported without masking them |
| Legacy isolation | Independent `legacy/` npm project is present | Root pnpm install ignores it and preserves its lockfile | No workspace dependency may resolve through `legacy/` |

</frozen-after-approval>

## Code Map

- `package.json` — replace loose toolchain engines and root dev ranges with exact reviewed pins; keep Story 1.2 script work out of scope.
- `apps/web/package.json` — pin Next 15.5.27, React/DOM 19.3.0, Tailwind 4.3.3, TypeScript 6.0.3, and compatible React types exactly.
- `packages/ai/package.json` — pin Anthropic SDK 0.131.0 and move AI from Zod 3 to Zod 4.6.5 without changing pipeline behavior.
- `packages/core/package.json` — pin the shared Zod 4.6.5 contract baseline.
- `packages/api/package.json`, `packages/db/package.json` — own exact reviewed tRPC/Inngest and Prisma 7.10.x package pins needed by the foundation, without implementing their later runtime designs.
- `.github/workflows/verify.yml` — use Node 24 and Corepack pnpm 12.8.2 for the current workspace; preserve the independent legacy job.
- `pnpm-workspace.yaml`, `.npmrc` — retain workspace membership, isolated linker, and approved esbuild lifecycle configuration unless clean-install evidence requires a minimal correction.
- `pnpm-lock.yaml` — replace the malformed pnpm-self-lock plus workspace-lock concatenation with one valid, deterministic workspace document.
- `README.md` — document Node 24 and Corepack bootstrap so onboarding does not assume global pnpm.
- `docs/BUILD-LOG.md` — prepend the dependency delta, clean-install evidence, checks run, and any remaining failures; do not rewrite history.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `apps/web/package.json`, `packages/*/package.json` — reconcile direct dependencies with the reviewed baseline and exact compatible pins, placing Prisma, tRPC, and Inngest only in their owning packages.
- [x] `.github/workflows/verify.yml`, `README.md` — align current-workspace CI and documented bootstrap on Node 24, Corepack, and pnpm 12.8.2 while preserving legacy isolation.
- [x] `pnpm-lock.yaml` — regenerate one valid workspace lock with pnpm 12.8.2 and review resolution changes for unapproved majors or duplicate Zod lines.
- [x] `packages/ai/src/**`, existing tests as needed — make only compatibility corrections required by Anthropic SDK 0.131.0 and Zod 4.6.5; preserve observable generation behavior and regression coverage.
- [x] `docs/BUILD-LOG.md` — record before/after direct and material resolved versions plus exact verification results.

**Acceptance Criteria:**
- Given Node 24 and no globally installed pnpm, when Corepack activates the repository package manager and a frozen install runs from a clean state, then pnpm 12.8.2 installs the current workspace from one valid committed lock document without hidden tools.
- Given manifests and CI, when versions are inspected, then Node 24 and the reviewed exact dependency baseline are used, AI/shared contracts use Zod 4.6.5, and no unapproved major migration exists.
- Given the regenerated lock, when clean frozen installation is repeated, then the dependency graph is stable and the current workspace's existing package typechecks and tests run without bootstrap errors.
- Given the dependency review, when `docs/BUILD-LOG.md` is inspected, then it names the meaningful version delta, evidence, and remaining failures without overstating production readiness.

## Implementation Notes

- Corepack 0.36.0 is installed explicitly because it understands pnpm 12's `bin/pnpm.mjs` layout; Node is constrained to `>=24.15.0 <25`, Corepack 0.36.0's supported Node 24 range.
- `pmOnFail: ignore` leaves package-manager selection to Corepack and prevents pnpm 12 from self-managing the `packageManager` pin as a separate lock document.
- TypeScript 6 requires an ambient declaration for the web app's CSS side-effect import.
- Zod 4 makes `z.record(enum, value)` exhaustive; `z.partialRecord` preserves the existing sparse `DomainWeight` contract while still rejecting unknown keys.
- The added Prisma and Inngest dependency trees require explicit lifecycle approval for `@prisma/engines`, `prisma`, and `protobufjs`; no runtime persistence or job behavior was added.

## Spec Change Log

## Review Triage Log

## Design Notes

The repository-level “one lockfile” requirement applies to the current pnpm workspace. `legacy/` is deliberately excluded by `pnpm-workspace.yaml` and remains a read-only, independently verified npm reference project with its own historical lock; removing it would violate the approved extraction plan rather than improve current-workspace reproducibility.

## Verification

**Commands:**
- `corepack enable` and `corepack prepare pnpm@12.8.2 --activate` — expected: repository package manager is available without a global pnpm install.
- `pnpm install --frozen-lockfile` from a clean install state, repeated once — expected: both installs succeed and leave `pnpm-lock.yaml` unchanged.
- `pnpm -r typecheck` — expected: every current workspace TypeScript project passes under TypeScript 6.0.3.
- `pnpm test` — expected: all deterministic current-workspace tests pass.
- `pnpm --filter @zandegi/web build` — expected: the existing production web build remains compatible with the reviewed pins; this is compatibility evidence, not Story 1.2's canonical aggregate command.

**Results (2026-10-03):**

- With an empty `COREPACK_HOME`, Corepack 0.36.0 reported pnpm 12.8.2 and `corepack pnpm install --frozen-lockfile` passed.
- Two clean frozen installs passed with pnpm 12.8.2; the lockfile SHA-256 stayed `AAE96CF669A7877DACAADEFDFCC974492EF0BB326D6060DEAFC99222B6717358`.
- `pnpm -r typecheck` passed all 10 projects under TypeScript 6.0.3.
- `pnpm test` passed 30 files and 197/197 tests.
- `pnpm --filter @zandegi/web build` passed on Next 15.5.27.
- The lock is one YAML document, contains only Zod 4.6.5, excludes `legacy/`, and the legacy manifest and npm lock are unchanged.
- The host's bundled Corepack 0.34.0 is intentionally not used because it cannot launch pnpm 12's `bin/pnpm.mjs` layout.
