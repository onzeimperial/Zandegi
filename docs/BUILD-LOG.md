# Zandegi build log

Newest first.

---

## Session 1 (part 1) — core primitives + AI pipeline foundations

**Shipped**

- `.gitattributes` — LF normalisation, silences the Windows CRLF warning spew.
- **`@zandegi/core`** — the pure, deterministic foundation. 56 tests.
  - `domains` — the eight fixed domains, `DomainWeight` with sum-to-1 assertion,
    `primaryDomain`.
  - `goal-types` — `GoalType`, `EffortBand`, and `assertProgressDisplay` /
    `percentageAllowed` enforcing SPEC §1.3 (an OUTCOME goal can never render a
    percentage — product law 2).
  - `verification` — the five methods and their XP multipliers (SPEC §4.1).
  - `safety` — `SafetyClass`, `isGenerationBlocked`, `requiresProfessionalFrame`.
  - `scoring/xp` — `stepXp` with a full multiplier breakdown for auditability,
    `chapterCompletionXp` (2.5×), `missionCompletionXp` (4×).
  - `scoring/levels` — `xpForLevel = round(100 × n^1.6)`, `levelFromXp`,
    `levelProgress`, the seven ranks.
  - `scoring/rarity` — population fraction → tier + exclusivity score for the
    XP formula + the share-card headline.
- **`@zandegi/ai`** — pipeline foundations. 23 tests.
  - `router.ts` — the single place the Anthropic SDK is touched (CLAUDE.md §3);
    per-stage model tiers; `canGenerate()` gate; a clear error when the key is
    missing.
  - `types.ts` — the full pipeline type surface (GoalInput → Interpretation →
    ResolvedPursuit → DraftMission → ScoredMission → MissionGeneratedEvent).
  - `grounding.ts` — **stage 6, complete and tested.** `detectFactualClaims`
    (prices, %, deadlines, requirements, named rules, stats), `isValidSource`
    (title + parseable date within a 30-year freshness window), and the
    mission-level report. `isFullyGrounded` is the session-1 exit check.
  - `stages/07-score.ts` — **stage 7, complete.** Calls `@zandegi/core`, no
    model. `NEUTRAL_CONTEXT` for the harness (no real user / population yet).
  - `stages/08-safety.ts` — **stage 8, complete and tested.** Blocks
    SELF_HARM_ADJACENT outright; flags calorie targets / doses / unsafe rates /
    personal financial advice for rewrite; applies the professional frame.
  - `harness/goals.ts` — the 60-goal test set: 56 domain goals (7 per domain,
    real and messy — misspellings, vagueness, hyper-local, volatile facts) + 4
    adversarial (impossible scope, gibberish, a clinical-risk phrasing).
  - `harness/rubric.ts` — the six 1–5 axes, the judge prompt builder, and the
    aggregate that decides `passesExitBar` (specificity ∧ actionability ≥ 4.0).

**Verified** — `pnpm -r typecheck` (9/9), `pnpm test` (79/79), all committed.

**Fixed along the way** — the PowerShell scaffold script wrote package.json /
tsconfig / index.ts with a UTF-8 BOM (PS 5.1 `-Encoding utf8` behaviour), which
broke vitest's workspace resolution. Stripped BOMs from 20 files; added
`.gitattributes`.

**Still to do for session 1** (needs `ANTHROPIC_API_KEY`)

- Stages 1–5 model bodies + prompts (`interpret`, `resolve`, `plan`, `detail`),
  stage 3 `hydrate`, stage 9 `persist`.
- `pipeline.ts` orchestrator with the progressive-reveal callback.
- `harness/run.ts` (the runner) + `harness/report.ts` (the scored HTML page).
- Then: run the 60 goals, read 20 of them, iterate prompts until mean
  specificity and actionability are both ≥ 4.0.

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
