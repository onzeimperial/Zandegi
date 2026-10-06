---
title: 'Story 1.2 — Add Verification and Repository Guardrails'
type: 'chore'
created: '2026-10-05'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '1d0b5c860546abb6b4fada55eabed306f01feaec'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No root command matches the Phase 0 verification contract. `verify:current` omits production builds, so a broken build looks green; `pnpm verify` chains `verify:legacy`, which needs a separate `npm ci` inside `legacy/` and therefore cannot pass from a fresh pnpm-only checkout; nothing prevents a current app or package from importing `legacy/`; and `docs/BUILD-LOG.md` does not separate scaffolded packages from implemented capability.

**Approach:** Make `pnpm verify` the single canonical command for the current workspace — format check, lint, all ten package type checks, unit tests, production builds — failing non-zero at the first failing stage. Enforce the `legacy/` import boundary through the existing ESLint config with no new dependency, prove it with a test, keep legacy verification as its own script and CI job, and document the command for CI and local use.

## Boundaries & Constraints

**Always:** The canonical command must pass from a fresh checkout after Corepack activation and `pnpm install --frozen-lockfile` alone, with no globally installed tools. Every stage must propagate a non-zero exit; a stage that cannot read a path must fail rather than report success. The boundary rule covers every file under `apps/*` and `packages/*` and names the offending file and specifier. `legacy/` remains an independent npm project verified only by its own CI job. Record the verification results and any remaining failures honestly in `docs/BUILD-LOG.md`.

**Never:** Do not invoke legacy's npm scripts from the canonical command. Do not add `dependency-cruiser`, `eslint-plugin-boundaries`, `eslint-plugin-import`, or any other new dependency. Do not touch `.env.example`, environment documentation, or runtime config validation — those are split out in `deferred-work.md`. Do not add build scripts to packages that are consumed as TypeScript source. Do not modify `legacy/`, its manifest, or its lockfile. Do not provide an eslint-disable escape hatch for legacy imports; extraction means reimplementation against current contracts per AD-13. Do not implement Story 1.3's API boundary work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Canonical pass | Clean frozen install, no provider credentials | Format check, lint, ten type checks, unit tests, and the web production build all run; exit code 0 | N/A |
| Any stage fails | A type error, failing test, or broken build | The command stops at that stage and exits non-zero | The failing stage's own output is surfaced unmasked |
| Lint warning | A file triggers `no-explicit-any` | Lint exits non-zero rather than passing with warnings | Warning text identifies the file |
| Legacy import | A file in `apps/*` or `packages/*` imports `legacy/x`, `@/../legacy/x`, or `../../legacy/x` | Lint fails and names the offending file and import specifier | Non-zero exit from the lint stage |
| Unreadable path | A directory inside the repo cannot be scanned | The path is excluded by configuration, so no stage reports a false success | A scan error must never coexist with exit 0 |
| Fresh checkout | Documented prerequisites only, `legacy/` not installed | The canonical command completes without global tools and without entering `legacy/` | N/A |

</frozen-after-approval>

## Code Map

- `package.json` — scripts are the deliverable. `verify:current` (lint+typecheck+test, no build) and `verify` (chains `verify:legacy`) are what must change. `build` is already `pnpm -r build`; `format` is `prettier --write .` with no check variant.
- `eslint.config.js` — the only flat config; no per-package configs exist. Already ignores `legacy/**`, `_bmad/render/**`, `dist`, `.next`, `node_modules`. Rules are only `no-explicit-any` (warn) and `no-unused-vars`. Add the boundary rule here; reuse the existing `tseslint.config` structure.
- `vitest.workspace.ts` — `defineWorkspace(["packages/*", "apps/*"])`. Root-level tests are **not** discovered; a guardrail test needs its own project entry.
- `.github/workflows/verify.yml` — two jobs. `current` already does Node 24.15.0 + Corepack 0.36.0 + pnpm 12.8.2 + frozen install, then runs `pnpm verify:current`. `legacy` is a separate job on Node 22 with `npm ci`; leave it untouched.
- `README.md:37-53` — the Getting started block lists `pnpm -r typecheck` and `pnpm test` separately; it must name the canonical command instead.
- `docs/BUILD-LOG.md` — newest-first; prepend only.
- `apps/web/package.json` — the only package with a `build` script, so `pnpm -r build` already resolves to the web build alone. Do not change.
- Reference only, do not modify: ten `tsconfig.json` files across `apps/web` and `packages/*` (the ten type-check projects), and `packages/celebrations` which has tests but no `vitest.config.ts` and runs correctly on defaults.

## Tasks & Acceptance

**Execution:**
- [x] `.prettierignore` — create it, excluding `_bmad/render`, `legacy`, `dist`, `.next`, `node_modules`, `pnpm-lock.yaml`, and `*.tsbuildinfo` — Prettier currently prints `EPERM` on an unreadable `_bmad/render` path yet still exits 0, so without this a format stage reports false success.
- [x] `package.json` — add `format:check`, add a `lint` that fails on warnings, and redefine `verify` as the canonical ordered chain (format check, lint, typecheck, test, build) scoped to the current workspace; keep `verify:legacy` as a separate script no longer chained into `verify`.
- [x] `eslint.config.js` — add a `no-restricted-imports` rule for `apps/**` and `packages/**` blocking `legacy`, `legacy/*`, `**/legacy/**`, and `*/legacy/*`, with a message naming the boundary and pointing at AD-13.
- [x] `vitest.workspace.ts`, `tooling/import-boundary.test.ts` — add a root project entry for repo guardrail tests and a test that lints fixture source through the ESLint Node API, asserting the rule fires for a legacy import and stays silent for a `@zandegi/*` import.
- [x] `.github/workflows/verify.yml` — point the `current` job at the canonical command; leave the `legacy` job and its Node 22 / `npm ci` steps unchanged.
- [x] `README.md` — replace the separate typecheck/test lines with the canonical command and state that it covers the current workspace only.
- [x] `docs/BUILD-LOG.md` — prepend an entry separating scaffolded packages from implemented capability, with the verification evidence and any remaining failures stated plainly.

**Acceptance Criteria:**
- Given a clean installed workspace, when the canonical root command runs, then linting, all ten package type checks, unit tests, and production builds execute, and the command exits non-zero if any required check fails.
- Given a current app or package that imports anything from `legacy/`, when repository verification runs, then the import-boundary check fails and reports the offending path, and no approved escape hatch exists for importing legacy code.
- Given a fresh checkout using only the documented prerequisites, when the canonical command is executed, then it completes without hidden global tools and without installing or entering `legacy/`, and the command is documented for both CI and local development.
- Given `docs/BUILD-LOG.md` after this story, when the foundation status is read, then scaffolded packages are clearly distinguished from implemented production capability and the verification results and known remaining failures are recorded without overstating readiness.

## Implementation Notes

- `.prettierignore` alone does not fix the `_bmad/render` `EPERM`: Prettier filters matched files
  with the ignore file but still walks the directory tree, so `prettier --check .` exited 2 on the
  scan error. The format scripts therefore also pass `"!_bmad/**"` on the command line, which stops
  the walk. The stage still fails loudly on any other unreadable path, so there is no false success.
- `.prettierignore` carries the specified entries plus the tool-owned trees we do not author
  (`.agents`, `.claude`, `_bmad`, `_bmad-output`, `design`). Without them the format stage would have
  rewritten installed skill content and frozen spec sections, and could never have reached exit 0.
- Making the format stage pass required reformatting 65 workspace source files under `apps/`,
  `packages/`, and `scripts/`, plus `docs/BUILD-LOG.md`. This is a whitespace-only diff with one
  exception, `apps/web/src/app/routes.test.ts`, where five assertions matched unspaced source text
  (`type:"add-step"`, `prefers-reduced-motion:reduce`, and three more); they are now
  whitespace-tolerant regexes.
- `verify:current` was removed rather than kept alongside `verify`, since the Code Map identifies it
  as the script that must change and two near-identical gates invite drift. CI's `current` job now
  runs `pnpm verify`; the `legacy` job is unchanged.
- `format` was changed alongside `format:check` so both share the same path exclusions; leaving
  `format` exiting 2 while `format:check` exits 0 would have been incoherent.
- The boundary test shares one warmed `ESLint` instance via `beforeAll` with explicit generous
  timeouts, and only one file in `tooling/` may construct one - a second instance reloads the flat
  config in parallel and took the suite to 2333s. Flat-config load dominates cost and is
  machine-dependent: 6.2s on the build machine, 44.6s on a reviewer's.
- `no-restricted-imports` only inspects static import/export declarations, so the boundary needed a
  second rule - `no-restricted-syntax` on `ImportExpression` with a literal legacy source - or a
  dynamic `import("../../legacy/x")` would have been an unguarded escape hatch against AC2. The
  rule block is scoped to `apps/**`, `packages/**`, `scripts/**`, and `tooling/**`, since `scripts/`
  holds five real design-capture scripts that the narrower scope left uncovered.
- `pnpm -r typecheck` only recurses into workspace packages, so the files that enforce the whole
  contract were never type-checked. The smallest fix was `tsconfig.tooling.json` (covering
  `tooling/**/*.ts`, `vitest.workspace.ts`, and `eslint.config.js` with `checkJs`) plus
  `&& tsc -p tsconfig.tooling.json` on the root `typecheck` script. It caught one real error.
- Counts of type-check projects were removed from `README.md`, `verify.yml`, and the build log
  rather than maintained: `apps/admin` and `apps/mobile` gain tsconfigs soon. The contract is
  asserted instead - every workspace directory with a `tsconfig.json` must declare a `typecheck`
  script.

- The reformat was audited rather than taken on trust: the baseline was checked out into a
  throwaway worktree, `prettier --write` was replayed over `apps/**`, `packages/**`, `scripts/**`,
  and the result compared file by file. Re-run through the Prettier API at review time: of the 65
  touched source files, 64 are byte-identical to Prettier's own output after two passes, so they are
  provably formatting-only (`generation-flow.test.ts` is the file needing the second pass; Prettier
  is not idempotent on it). The sole behavioural edit
  is `routes.test.ts`, where five assertions moved from `toContain` on unspaced text to
  whitespace-tolerant `toMatch` regexes; the negative assertion became stricter as a result.
- `tooling/verify-contract.test.ts` was added to close the Matrix Test Audit. Three matrix rows had
  no automated cover: "Any stage fails" (the `&&` chain and its cheapest-first order), "Lint warning"
  (`--max-warnings 0`, without which severity-1 `no-explicit-any` could never fail the gate), and
  "Unreadable path" (`_bmad/render` ignored via `prettier.getFileInfo`, plus the command-line
  exclusion in both format scripts). Six tests here, one added to `import-boundary.test.ts`.
- Two cost traps found while adding those tests, both now avoided and recorded in the build log.
  A second `ESLint` instance in a second test file reloads the flat config in parallel and took the
  suite from 10s to 2333s, so the severity assertion lives on the warmed instance in
  `import-boundary.test.ts`. Asserting severity by linting `const x: any = 1` pulls in the
  TypeScript parser and cost 42s, so it reads `calculateConfigForFile` instead. Final state:
  208 tests across 32 files in 9.6s, `pnpm verify` exit 0.
- The "Fresh checkout" matrix row is not covered by a unit test and was not re-proved locally: this
  machine runs Node 24.11.0, below the pinned `>=24.15.0`, and its bundled Corepack 0.34.0 cannot
  launch pnpm 12, so `pnpm` is not on PATH. Verification here ran through a shim onto the cached
  pnpm 12.8.2 payload. CI's `current` job is the real cover -- it checks out clean, enables Corepack,
  installs frozen, and runs `pnpm verify` on every push. That row stays unproven until CI runs.

## Spec Change Log

## Review Triage Log

Verified by probing the shipped flat config with the ESLint Node API, by re-running the
Prettier replay through `prettier.format`, and by running `eslint . --max-warnings 0` directly.
Severity ignored as filed; graded here.

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | Dynamic `import()` / `require()` escape the boundary (blind, edge-case, verification-gap) | high | Confirmed: `await import("../../legacy/src/x")` from `packages/core/src` raises no `no-restricted-imports`. Static, bare, aliased and `export * from` all fire. `require()` is caught only incidentally by `no-require-imports`. AC2 promises no escape hatch. | patch |
| 2 | Rule does not cover `scripts/`, `tooling/`, repo root (blind) | medium | Confirmed ALLOWED from all three. `scripts/` holds five first-party `.cjs` files, four touched in this diff. | patch |
| 3 | Guardrail code is never type-checked (blind) | medium | Confirmed: no root `tsconfig.json`, and `pnpm -r typecheck` recurses only into `apps/*` and `packages/*`, so `tooling/*`, `vitest.workspace.ts` and `eslint.config.js` are excluded. | patch |
| 4 | Build stage can be gutted with every test green (verification-gap) | medium | Pre-verified by that layer: `verify-contract` asserts only that a `build` key exists, so `"build": "echo skip"` keeps the suite green and removes the production build the story exists to add. | patch |
| 5 | `apps/**` half of the boundary is unpinned by tests (verification-gap) | medium | Pre-verified: all boundary assertions use one `packages/core/src` fixture, so narrowing the config to `files: ["packages/**"]` leaves tests green. Rule does fire for `apps/**` today — confirmed independently. | patch |
| 6 | BUILD-LOG entry has no "exact next step" (blind) | medium | Confirmed absent; CLAUDE.md section 5 requires it of every entry. | patch |
| 7 | Spec and build-log file counts contradict each other (blind) | medium | Confirmed, and both were wrong. Replay via the Prettier API: 65 source files changed, 64 byte-identical to Prettier output after two passes, exactly 1 behavioural (`routes.test.ts`, five assertions). | patch |
| 8 | Nothing pins CI to the canonical command (blind) | low | Confirmed: `verify-contract` never reads `verify.yml`. Fix is a direct addition. | patch |
| 9 | `toEqual([1])` breaks if the rule is tightened (blind, edge-case) | low | Confirmed: asserting the exact array fails when severity becomes `"error"` or options are added — the guard breaks on a change that strengthens it. | patch |
| 10 | README misdescribes how legacy is verified in CI (blind) | low | Confirmed: the `legacy` job runs `npm ci` / `npm run typecheck` / `npm test` directly; `verify:legacy` is invoked nowhere in CI. | patch |
| 11 | README never mentions `pnpm format` as the fix for the new first stage (blind) | low | Confirmed absent from Getting started, and the two-pass caveat lives only in the build log. | patch |
| 12 | "ten type checks" hardcoded in three places, asserted nowhere (blind) | low | Confirmed correct today (9 packages + `apps/web`); stale the moment `apps/admin` or `apps/mobile` gains a tsconfig, which the same entry calls imminent. | patch |
| 13 | The 2333s ESLint-instance invariant is enforced only by a comment (blind) | low | Real: a third guardrail file reintroduces it silently and the symptom is a hanging CI job. Fix is a cheap test. | patch |
| 14 | `.split("&&")` throws a TypeError if `verify` is removed (edge-case) | low | Confirmed: fails unreadably rather than with a clear assertion. | patch |
| 15 | `deferred-work.md` entry carries `source_spec: none` (blind) | low | Confirmed: written before this spec existed; the sibling entries carry spec paths, so the deferral is unattributable. | patch |
| 16 | Shared-instance cost claim overstated (verification-gap, other) | low | Confirmed variance: notes claim "under 4s"; measured 6.2s here and 44.6s on the reviewer's machine. | patch |
| 17 | `routes.test.ts` source-text coupling only half-fixed (blind) | low | Confirmed: `not.toContain('href="#"')`, `not.toContain("fetch(")`, `:focus-visible`, `aria-live="assertive"` still match raw source, and the negative ones fail open. Pre-existing; this story did not create them. | defer |
| 18 | CI has no concurrency group, no pnpm/`.next` cache, no `permissions:`; `.prettierignore` omits `coverage`/`out`/`.turbo` (blind) | low | Confirmed. The double-run and missing `permissions:` pre-date this story; adding `build` to the gate made the cost matter. Optimisation, not a defect. | defer |
| 19 | `eslint .` exits 2 on an unreadable root directory (edge-case, twice filed) | false | Refuted: `eslint . --max-warnings 0` exited 0 in three independent runs (11.4s and 13s measured). ESLint's flat-config `ignores` cover `_bmad/render/**` and prevent the descent that killed Prettier. The reviewer's ENOENT is consistent with my own concurrent worktree churn during their run. | rejected |
| 20 | Canonical chain's exit 0 is environment-dependent (edge-case) | false | Same refutation as row 19; `pnpm verify` exited 0 end to end here after the reviewers ran. | rejected |
| 21 | `tooling` Vitest project would miss root tests outside `tooling/` (edge-case) | low | Real but speculative — no tests exist outside `tooling/` at root, and broadening the glob invites unintended pickup. Row 3's typecheck fix covers the same files. | rejected |
| 22 | `verify:current` still referenced in the legacy extraction plan (edge-case) | low | Characterisation is wrong: the planning artifact describes the pre-repair state in the past tense ("cannot yet be treated as the reproducible verification command"); it does not instruct anyone to run it. | rejected |
| 23 | `sprint-status.yaml` should read `review`, not `in-progress` (blind) | false | Refuted: step-05 of this workflow syncs the story to `review` on completion. The state observed in the diff is the correct mid-workflow value. Story 1.1 sitting at `in-progress` is a separate, real bookkeeping gap, raised with the user. | rejected |

## Design Notes

The canonical command is scoped to the current pnpm workspace because the Phase 0 contract requires it to pass "in a fresh checkout" "without hidden global tools", and `legacy/` is an independent npm project with its own lockfile and CI job. Chaining `verify:legacy` into `verify` would make the canonical command fail on any checkout where only `pnpm install` has run. AD-13 makes `legacy/` a read-only extraction source, so verifying it is a separate concern, not part of the current workspace's gate.

ESLint carries the boundary rule because it is already installed, already configured for every `apps/*` and `packages/*` file, and reports the file and specifier for free. A dedicated boundary tool would add a dependency for a rule with one pattern. The known limit: `no-restricted-imports` inspects import specifiers only, so it would not catch a `tsconfig` path mapping or a bundler alias pointing into legacy. There are currently zero legacy references of any kind, so the rule is preventative, and the limit belongs in the build log rather than in extra tooling.

Ordering matters in the chain — the cheap checks run before the slow build so a formatting or type error fails in seconds rather than after a full `next build`:

```jsonc
"verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
```

`lint` must fail on warnings (`--max-warnings 0`), otherwise `no-explicit-any` — the rule that enforces CLAUDE.md §3 — can never fail the gate. The repo is currently clean at zero errors and zero warnings, so this costs nothing today.

## Verification

**Commands:**
- `pnpm verify` — expected: every stage runs in order and the command exits 0 on the current tree.
- `pnpm format:check` and `pnpm lint` run individually — expected: both exit 0, and neither prints a scan or permission error.
- `pnpm test` — expected: the existing 197 tests still pass, plus the new import-boundary test, and the new root project is discovered.
- Temporarily add `import "../../legacy/src/lib/x"` to a file in `packages/core/src`, then run `pnpm lint` — expected: non-zero exit naming that file and specifier. Revert afterwards.
- Break the web build temporarily (e.g. a type error in a page), then run `pnpm verify` — expected: non-zero exit from the build stage. Revert afterwards.
- `git -C legacy status --porcelain` plus `git status --porcelain legacy` — expected: empty; `legacy/` and its lockfile are untouched.
