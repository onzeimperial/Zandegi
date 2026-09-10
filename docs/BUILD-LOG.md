# Zandegi build log

Newest first.

---

## Session 0 — Monorepo scaffold

**Shipped**

- Governing docs at their canonical locations: `CLAUDE.md` (root), `docs/SPEC.md`,
  `docs/BUILD-PROMPTS.md`.
- The pre-monorepo prototype (a single Next.js goal-tracker app, ~194 tests, ~48 routes)
  moved wholesale into `legacy/`. Nothing deleted. It is reference only and not part of
  the build from here.
- pnpm workspace: `apps/*` + `packages/*`. Root `package.json` (type: module, pnpm 12.3.4
  pinned), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `noEmit`), `.npmrc`, flat `eslint.config.js`, `.prettierrc.json`, `vitest.workspace.ts`,
  monorepo `.gitignore`.
- Eight package skeletons — `core db api ai ui tools economy integrations` — each with
  `package.json`, `tsconfig.json`, and a documented placeholder `src/index.ts`. No logic
  in any of them yet.
- `apps/web`: Next.js 15.5 + React 19 + Tailwind v4 (CSS-first `@theme`, SPEC Part VIII
  palette tokens), `transpilePackages: ["@zandegi/core"]`, minimal `app/{layout,page}.tsx`.
- `apps/mobile` and `apps/admin`: README placeholders only, no `package.json`, so pnpm
  does not treat them as workspace packages. Built in sessions 9 and 6 respectively.

**Verified**

- `pnpm install` — 10 workspace projects resolve (esbuild build script explicitly allowed
  in `pnpm-workspace.yaml`; pnpm 12 blocks unapproved build scripts by default).
- `pnpm -r typecheck` — all 10 pass.
- `pnpm --filter @zandegi/web build` — compiles, static-generates, prints a route table.
  Confirms Next 15 / React 19 / Tailwind v4 / workspace-package import all work together.
- `pnpm lint` — clean (exit 0).

**Blocked / deferred**

- **`git` is not installed on this machine.** Git for Windows needs an interactive admin
  (UAC) prompt that cannot be approved from this shell. Consequence: the prototype was
  moved to `legacy/` as a folder rather than preserved on a branch; nothing is committed;
  the CLAUDE.md "small, working increments" commit workflow is not yet possible. Install
  Git for Windows and this switches to proper branching + conventional commits.
- **`ANTHROPIC_API_KEY` is empty in `.env`.** Session 1 (prove the mission generator) is
  entirely about model-generated output scored across 60 goals. The pipeline code can be
  written without a key, but session 1's deliverable — the scored HTML review page — and
  its exit criteria cannot be produced. Paste a real key into `.env` before session 1.

**Next step**

BUILD-PROMPTS **session 1**. Prerequisites it names that do not exist yet and must be
built as part of it (the spec assumed a prior codebase that isn't this one):

1. `packages/core` — the deterministic primitives stage 7 of the pipeline calls: goal-type
   guards (`assertProgressDisplay`), the XP/level/rarity formula stubs from SPEC Part IV
   (full economy is session 3; session 1 only needs enough for scoring to run).
2. The "zandegi-spike harness" — does not exist. Build it fresh: a script that runs N goals
   through the pipeline and emits the scored HTML review page.
3. `packages/ai` — the full 9-stage pipeline per SPEC §2.2, model router in
   `packages/ai/router.ts`, grounding validator.

Session 1 explicitly builds no UI, DB, or infra.
