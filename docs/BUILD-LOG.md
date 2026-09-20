# Zandegi build log

Newest first.

---

## Session 1 (part 2) — celebrations pilot, then the real generation pipeline + web wiring

Two pieces of work, done out of the documented BUILD-PROMPTS order at the user's explicit
direction after they asked "is there integrated AI in the website/app?" and the answer was no.

**Shipped — `packages/celebrations`**

- Curated celebration-video content pipeline backed by Seedance (via the `seedance` MCP server
  in `.mcp.json`). Pure, deterministic `selectCelebrationClip` (seeded hash, no `Math.random`) and
  `buildCelebrationPrompt`, matching CLAUDE.md §2.5 — no live model call sits on the completion
  path, only pre-generated, reviewed clips.
- `library/manifest.json` has 3 real clips (`"Universal"` domain, one per event type:
  step/chapter/level-up), committed to `library/generated/*.mp4` rather than left on the
  ephemeral Seedance CDN.
- **Lesson learned, documented in `GENERATING.md`:** the character reference image alone did not
  reliably hold the design across generations — the first pilot batch drifted badly off-brand on
  2 of 3 clips with a random seed. Fixed by adding `CHARACTER_DESCRIPTION` text to every prompt,
  restating colors/emblem/proportions in words rather than relying on image-reference adherence.
- Not wired to any live event — `packages/economy`/`db`/`api` don't exist yet.

**Shipped — the real mission generation pipeline (`packages/ai`) + `apps/web` wiring**

- Discovered `packages/ai`'s own doc comment was wrong: it claimed stages 1–5, 9, and the
  orchestrator were "scaffolded." They didn't exist as files at all — only stages 6 (ground), 7
  (score), 8 (safety) did, and the `spike` npm script pointed at a `harness/run.ts` that also
  doesn't exist. Flagged to the user before proceeding; they said build it for real.
- Built all remaining stages (`src/stages/01-interpret.ts` through `05-detail.ts`), Zod schemas
  for parsing model JSON (`src/schemas.ts`), and the orchestrator (`src/pipeline.ts`,
  `generateMission`). 44 tests, all model calls mocked so they run without a live key.
- Forced design decisions from the current repo state, documented at each source:
  - Stage 2 (resolve) always uses the generic scaffold — no Pursuit catalog exists (session 2).
    It still does real work: classifying domains/effortBand/**safetyClass** via a model call.
  - Stage 3 (hydrate) is a documented no-op — no knowledge layer exists (sessions 2 + 3).
  - Stage 9 (persist) constructs the `MissionGenerated` event but writes nothing — no database
    exists (session 3).
  - Safety gating happens *before* generation: `SELF_HARM_ADJACENT` short-circuits to
    `refusal.route: "support"` right after stage 2, never reaching plan/detail. `isImpossibleScope`
    similarly short-circuits to `refusal.route: "clarify"`.
  - Grounding (stage 6) and safety (stage 8) rewrite loops are real: flagged step text gets one
    model rewrite pass, then re-validates; anything still ungrounded after that is dropped
    outright, never shipped.
  - Progressive reveal is real: stage 5 (detail) runs once per chapter, each chapter is scored
    and streamed via `onEvent` as it lands, not held back for one final batch.
- Wired into `apps/web`: `src/app/api/generate/route.ts` (SSE streaming POST endpoint, no
  auth/DB — a demo endpoint) and `src/app/generate/page.tsx` (client page: type a goal, watch
  chapters stream in, see the scored mission). Added `@zandegi/ai` to `apps/web`'s dependencies
  and `next.config.mjs`'s `transpilePackages`.
- Rewrote the now-accurate doc comment in `packages/ai/src/index.ts`.

**Verified**

- `pnpm --filter @zandegi/ai typecheck` and `test` — 44 tests pass (orchestration logic, schema
  parsing, both safety short-circuits, the grounding rewrite loop — all with `router.complete`
  mocked).
- `pnpm --filter @zandegi/web typecheck` and `build` — clean; `/generate` and `/api/generate`
  both compile and appear in the route table.
- `pnpm -r typecheck` and `pnpm lint` clean (one pre-existing, unrelated lint error in
  `07-score.ts` predates this session).

**Blocked / deferred**

- **`ANTHROPIC_API_KEY` is still empty in `.env`.** Everything above is typechecked and unit-tested
  with a mocked model client, but nothing has been run against a live model — the actual
  generation *quality* is unverified. This is the immediate next blocking step and is the user's
  to supply, not something addable from this session.
- No rebuild of the session-1 scored-HTML eval harness (`harness/run.ts`) — still doesn't exist.
  The `/generate` demo page is the quality check for now.
- No database, no auth, no persistence — sessions 3/4 territory, untouched.

**Next step**

Get a real `ANTHROPIC_API_KEY` into `.env`, run `pnpm --filter @zandegi/web dev`, open
`/generate`, and actually read what it produces — including at least one adversarial goal
("become a billionaire by March") to confirm the clarify-refusal path. Session 1's real exit bar
(mean specificity/actionability ≥ 4.0 across 60 goals, zero ungrounded claims) still isn't
formally measured without the harness.

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
