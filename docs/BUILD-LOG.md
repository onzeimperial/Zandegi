# Zandegi build log

Newest first.

---

## 2026-10-03 - reproducible supported workspace

**Shipped**

- Aligned the current workspace and CI on Node >=24.15.0 <25, Corepack 0.36.0-selected pnpm
  12.8.2, and exact direct dependency pins. The material delta is pnpm 12.3.4 -> 12.8.2,
  TypeScript 5.9.3 ->
  6.0.3, Next 15.5.25 -> 15.5.27, React/DOM 19.2.8 -> 19.3.0, Anthropic SDK 0.65.0 ->
  0.131.0, and the previous Zod 3.25.76/4.5.4 split -> one Zod 4.6.5 line.
- Added the reviewed foundation pins in their owning packages: tRPC 11.19.0 and Inngest 4.21.0
  in `@zandegi/api`, plus Prisma Client/CLI 7.10.0 in `@zandegi/db`. No routes, jobs, schema, or
  persistence behavior were added.
- Replaced the concatenated lockfile with one workspace YAML document. Corepack remains
  responsible for package-manager selection; `pmOnFail: ignore` prevents pnpm self-management
  from appending a separate package-manager lock document. Approved only the lifecycle scripts
  required by the reviewed graph: esbuild, Prisma/engines, and protobufjs.
- Added the minimal TypeScript 6 CSS-module declaration and changed the AI domain-weight schema
  to Zod 4's `partialRecord`, preserving the existing sparse-domain behavior.

**Verified**

- A temporary Corepack 0.36.0 installation with an empty `COREPACK_HOME` reported `0.36.0`,
  prepared pnpm 12.8.2, reported `12.8.2` through `corepack pnpm --version`, and completed
  `corepack pnpm install --frozen-lockfile` successfully. The local Node 24.11.0 engine warning
  confirms why supported bootstrap and CI begin at Node 24.15.0.
- Two clean `pnpm 12.8.2 install --frozen-lockfile` runs succeeded with 515 packages. The
  lockfile SHA-256 remained
  `AAE96CF669A7877DACAADEFDFCC974492EF0BB326D6060DEAFC99222B6717358` across the repeat.
- `pnpm -r typecheck` passes all 10 TypeScript projects under TypeScript 6.0.3.
- `pnpm test` passes 30 files and 197/197 deterministic tests.
- `pnpm --filter @zandegi/web build` succeeds on Next 15.5.27 and emits all expected routes.
- Every external direct dependency is exact, the workspace lock contains one Zod version, and
  `legacy/package.json` plus `legacy/package-lock.json` remain unchanged and absent from the pnpm
  graph.

**Known risk / remaining evidence**

- Node 24.11.0's bundled Corepack 0.34.0 cannot launch pnpm 12 because it still expects
  `bin/pnpm.cjs`. Bootstrap therefore installs the reviewed Corepack 0.36.0 explicitly and the
  Node engine/CI pin starts at 24.15.0, Corepack 0.36.0's supported Node 24 floor. On machines
  where Node is installed under a protected system directory, the documented global Corepack
  installation and shim enablement may require an elevated shell.

---

## 2026-09-25 - current generation foundations repair

**Shipped**

- Added separate `verify:current`, `verify:legacy`, and aggregate `verify` commands plus independent
  Node 22 CI jobs. The pnpm workspace and `legacy/` npm lockfile remain independent.
- Hardened every public scoring input and aggregate against `NaN` and infinities without changing
  finite scoring behavior, including the existing fractional-minute, max-level, and rarity-headline
  corrections.
- Reworked generation rewrites around server-owned issue IDs and exact text-field locations. Missing,
  duplicate, unknown, or residual grounding/safety findings now fail closed, and chapter content is
  released only after both validators pass.
- Threaded one `AbortSignal` through the pipeline and every paid model call. The web route now enforces
  a 25-second deadline, aborts on disconnect, validates strict bounded JSON, hides internal failures,
  attaches request IDs, and is disabled in production unless
  `ENABLE_UNAUTHENTICATED_GENERATION=true`.
- Extracted a tested SSE consumer that requires exactly one terminal result and treats error messages,
  malformed streams, duplicate terminals, and premature EOF as failures.

**Verified**

- Canonical: lint clean; all 10 TypeScript configs pass; 148/148 tests pass.
- Legacy: typecheck passes and 194/194 tests pass after generating its locked Prisma client.
- `apps/web`: production build succeeds and emits `/generate` plus `/api/generate`.
- Both lockfiles remained unchanged.

**Known risk / next step**

- Live Anthropic behavior remains unverified because no API key was used; all model interactions are
  deterministic mocks. The production demo remains off by default until authentication and rate
  limiting exist.

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
## Website design integration — 28 September 2026

**Shipped**

- Rebuilt the supplied 12-board prototype as responsive Next.js routes and generator states.
- Added the light violet Zandegi token layer, reusable shell/navigation/status components, accessible controls, mobile navigation, visible focus, and reduced-motion handling.
- Integrated the existing `/api/generate` SSE contract into ambition, live build, review, refusal, error, abort, and retry states without changing the API or AI/core packages.
- Added typed UI-only fixtures for Path, Profile, Crew, Shop, Step, completion, and Customise previews. Backendless mutations are disabled or explicitly local-only.
- Added generator state/request tests and server-rendered mission review tests, including qualitative OUTCOME progress.

**Verified**

- Strict web TypeScript and ESLint pass.
- Repository Vitest: 192 tests across 29 files pass, including existing API/SSE suites and auth, local builder/customiser, generation orchestration, submission guard, and preview-boundary coverage.
- All 10 current TypeScript projects and repository ESLint pass.
- Next production build compiles and pre-renders all 11 UI routes plus the API route.

**Deferred / risk**

- The prototype's embedded mascot/font binaries were intentionally not copied because provenance is unverified; the UI uses robust font fallbacks and a code-safe Zandegi mark.
- Auth, persistence, purchases, social actions, scheduling, evidence upload, and rewards remain honest previews until their backends exist.
- Manual screenshot comparison at 1440×900, 768×1024, and 375×812 still needs a browser pass.

**Next step**

Run the app with a configured generation provider, intercept a representative SSE stream, and complete the visual/keyboard/screen-reader browser pass across the target viewport sizes.

## Exact Claude Design fidelity — 29 September 2026

**Shipped**

- Replaced all 12 approximation boards with the authored Claude Design geometry, exact Baloo 2/Nunito subsets, mascot PNG, inline SVGs, copy, cards, rails, dashboards, and editor states.
- Added deterministic extraction, rendered-DOM capture, production screenshot capture, and Sharp diff tooling.
- Preserved the real mission-generation SSE/refusal/error path and wired it beneath the authored ambition surface; backendless routes remain labelled local previews.

**Verified**

- Extractor: 12 pages, one mascot hash, nine font hashes, no drift.
- ESLint and all 10 TypeScript projects pass.
- Vitest: 195 tests across 30 files pass.
- Next production build passes.
- At 1440×900, six boards are pixel-identical at threshold and the other six differ by only 0.003–0.320%, limited to animation/form-control rasterization with no design substitution.

**Deferred / risk**

- Auth, persistence, purchases, scheduling, social actions, evidence verification, and rewards remain honest local/non-persistent previews until their backends exist.

**Next step**

Connect those preview boundaries only when their corresponding backend contracts are implemented; retain the captured design boards as regression fixtures.


## Real component port of the Claude Design — 1 October 2026

**What was wrong**

The previous session did not port the design, it photocopied it. `capture-rendered-design.cjs`
scraped `document.body.innerHTML` from each Claude reference page into `design-boards.json`, and
every route rendered that string through `dangerouslySetInnerHTML`. The reported fidelity numbers
were therefore circular — the export's own DOM measured against the export — which is why six
boards scored exactly 0.000%. The consequences were real: `min-width:1440px` plus overridden media
queries made every screen fail the 375px rule, interactivity was faked with `cloneNode` and
`style.cssText` swaps against stripped markup, and the live generation screen still rendered the
old approximation because the authored design only appeared behind `?visual=` preview URLs.

**Shipped**

- Deleted the photocopy layer: `exact-board.tsx`, `exact-interactive-board.tsx`,
  `design-boards.json`, `exact-design.css`, `capture-rendered-design.cjs`, and the circular
  `visual-fidelity.test.ts`. Kept the asset extractor and the reference bundles, which are sound.
- Rebuilt `globals.css` on the authored values in `claude-reference/*.source.html`: real tokens,
  Baloo 2 restored as the display face (the approximation had substituted Trebuchet MS), px
  geometry, and a responsive layer that works down to 375px instead of forcing a desktop canvas.
- Ported `/path` (board 05) as real components, and corrected `AppShell`, `StatusRail` and `Icon`
  against the export.
- Removed the `?visual=` preview branches so the live generating and review states carry the
  design, and restored the real ambition form over the working SSE pipeline.
- Added `scripts/side-by-side.cjs`, which composes reference-vs-implementation sheets for human
  review rather than asserting a self-referential threshold.

**Learned**

Four systemic causes accounted for nearly all the drift, found by diffing computed geometry in the
browser rather than by eye:

1. Tailwind preflight forces `line-height:24px` and we had set `font-weight:600`; the export uses
   the browser defaults and sets weight per element. This shifted text inside every fixed box.
2. The export authors sizes as `content-box` unless it says otherwise, so a 44px avatar with a 3px
   border paints at 50px. Under our `border-box` reset the error compounds down a column.
3. The shell is a fixed viewport with `main` scrolling inside. Letting the page scroll instead cost
   16px to a scrollbar and moved every column.
4. Next's image optimiser resamples the mascot from a different source size than the export, so the
   design assets need `unoptimized`.

**Verified**

- `/path` is pixel-identical to the reference at 1440×900 (0.000% changed pixels), as a component
  port rather than injected markup.
- At 375px there is no horizontal overflow and the mobile nav replaces the sidebar.
- ESLint clean, all 10 TypeScript projects clean, 194 tests across 30 files pass, production build
  passes.

**Deferred**

- Boards 00–04 and 06–11 still render the earlier approximation. They build and pass, but they are
  not yet faithful; their CSS is carried in `globals.css` under a clearly marked section.
- Test count moved 195 → 194 because the circular fidelity test was removed and the auth test's
  `data-board` assertion was replaced with a structural one.

**Next step**

Port boards 06 (`/step`), 07 (`/complete`) and 05's siblings next, reusing the four corrections
above, then the profile/crew/shop/customise group, then auth/ambition/generation/review/builder.
Review each group with `node scripts/side-by-side.cjs <index>` before moving on.

## Remaining eleven boards ported — 1 October 2026

**Shipped**

All twelve Claude Design boards are now real React components. Nothing renders injected export
markup any more; `design-boards.json` and both injector components are gone.

- Entry and generation: `/` (auth), the ambition form, the live build progress, the review, and the
  manual builder. The build and review screens are now the real `generating` and `done` states of
  the SSE pipeline instead of `?visual=` preview URLs.
- Shell screens: `/path`, `/step`, `/profile`, `/crew`, `/shop`, plus the full-bleed `/complete` and
  `/customise`.
- `StatusRail` became composable (`cards={["crew","league","drop"]}`) because each board shows a
  different subset. `FlowHeader` carries the shared 76px onboarding header.
- The customiser is a real parametric character: `customise-state.ts` holds the authored catalogue
  (skin, hair, top, pants, shoes, multi-select extras) and `CharacterArt` is a pure function of the
  selection. Locked items are gated in the reducer, so the UI cannot bypass them.
- `scripts/geometry-diff.cjs` compares laid-out box geometry between the reference and the route,
  matching by text. It found every defect below far faster than reading pixel diffs.

**Measured** (1440x900, changed pixels)

00 0.312% · 01 2.348% · 04 1.258% · 05 0% · 06 0.099% · 07 0% · 08 0.307% · 09 0.059% · 10 0% ·
11 0.099%. Boards 02 and 03 only exist after a live generation, so they cannot be reached by URL
and are excluded from the sweep; they need a manual pass with a real API key.

Every route is free of horizontal overflow at 375px.

**Where the implementation deliberately differs from the mock**

The export is a visual mock, not a source of truth for behaviour or vocabulary. Four divergences
are intentional and are recorded as allowances in `scripts/compare-claude-design.cjs`:

1. **Domain names.** The mock labels the eight tiles Learning, Wealth, Spirit, Adventure. SPEC 1.1
   and `@zandegi/core` fix them as Mind, Edge, Coin, Body, Grit, Craft, Bond, World, "fixed
   forever". The spec wins; the mock's glyphs are mapped onto the real names.
2. **Pipeline stages.** The mock sketches five; `StageEvent` reports eight. The live screen shows
   what actually ran.
3. **Step XP.** The mock hardcodes 20/40/60. XP now comes from `verificationMult` in core, so the
   builder shows 40/50/56 and cannot invent a number (CLAUDE.md 2.5). Core has no
   peer-confirmation method, so "Peer confirms" has no equivalent yet — a real gap, not a port bug.
4. **Honest copy and states.** The mock says "Draft saved" on a draft that is not saved, and
   pre-highlights an ambition chip while leaving the input empty, which would enable "Build my
   mission" with nothing typed. Both are corrected.

Two smaller ones: board 06's reference PNG renders sets 1-3 unchecked although the authored source
marks them `checked` and styles the rows as complete — the export runtime dropped the attribute, so
the source wins. Controls with no backend are disabled buttons rather than dead `href="#"` links.

**Learned**

Beyond the four systemic causes in the previous entry, the recurring defect was **class-name
collision**. Legacy approximation CSS shared selectors with the new components (`.step-grid` carried
`margin: 2rem auto`; `.profile-head` carried `padding: 1.2rem`), and once a collision was between
two of my own rules (`.domain` as both a profile tile and a celebration label). Legacy rules are now
pruned as each board lands, and only `.preview-note` remains.

Also: buttons compute `border-box` by default while labels, list items and images are `content-box`,
so the box-model correction is per-element, not blanket.

**Verified**

ESLint clean, all 10 TypeScript projects clean, 197 tests across 30 files, production build passes,
full comparison sweep exits 0.

**Deferred**

- Boards 02 and 03 have no automated visual check. Driving them needs a live generation.
- `/complete` and `/customise` have no mobile-specific layout beyond not overflowing; they were
  authored desktop-only and deserve a designed small-screen treatment.
- Core has no peer-confirmation verification method; the builder cannot offer that tier until it
  exists.

**Next step**

Have a person review `_bmad-output/implementation-artifacts/visual-diffs/side-by-side/*.png`, then
commit. After that, drive a real generation once to eyeball boards 02 and 03.
