---
title: 'Story 1.3 — Put Mission Generation Behind the API Boundary'
type: 'refactor'
created: '2026-10-06'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'fdb45288c310c03a9a0933039bbc6b54980285f9'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app orchestrates generation itself. `apps/web` imports `@zandegi/ai` in seven places, including the `ScoredChapter`/`PipelineResult` types, so the client depends on internal pipeline shapes and `@zandegi/api` is an empty scaffold. The pipeline's `persist` stage fabricates a `MissionGenerated` event with its own `occurredAt` and writes nothing, and its `score` stage attaches `baseXp`/`completionXp` to generated content that the UI renders as `+30 XP` — XP whose magnitude comes from a model-supplied `estimatedMinutes`, which is the law-5 violation even though the arithmetic itself is `core`'s.

**Approach:** Make `@zandegi/api` own the generation use case and the client-safe contract, with the clock, identifiers, cancellation and persistence supplied as explicit ports. Narrow `@zandegi/ai` to returning validated draft content with no XP and no fabricated event. Point every web import at `@zandegi/api/client` and `@zandegi/core/contracts`, and remove the XP promise from the preview while keeping planning estimates visible and plainly non-authoritative.

## Boundaries & Constraints

**Always:** `@zandegi/api` owns orchestration, the one use case the web adapter calls, and the transaction boundary. The clock, ID generation, cancellation signal and persistence reach the use case as injected ports; `ai` creates none of them. Generation stays a streamed response, because it runs for up to 25 seconds against a 25s application deadline. Error responses keep the existing stable codes and the `X-Request-Id` header; diagnostic detail stays server-side with personal content redacted. Planning estimates stay in the contract, labelled as estimates. Keep the deterministic XP formulas in `@zandegi/core` untouched — they are Epic 2's input.

**Never:** Do not let `apps/web` import `ai`, `db`, `economy`, `tools`, or server-only `core` policy, in runtime or type position. Do not emit XP, rarity, difficulty or priority numbers in generation output or preview UI. Do not create a `MissionGenerated` ledger fact — the persistence port stays a no-op for later stories. Do not implement Prisma persistence, guest identity, the versioned stream protocol, or the Pursuit catalog — those are stories 1.4, 1.16 and 1.19. Do not add a tRPC procedure for this path. Do not change model routing, prompts, or the stage logic that produces content.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful generation | Valid goal, `ANTHROPIC_API_KEY` set | Adapter streams ordered progress then one terminal result carrying a validated mission draft with no XP field anywhere | N/A |
| Validation failure | Unknown field, oversized body, bad timezone | Stable `INVALID_REQUEST`/`PAYLOAD_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE` with `X-Request-Id`, before any model call | Non-2xx JSON error body, no stream opened |
| Cancellation | Client disconnects mid-generation | Use case aborts through the injected signal, stream closes, no terminal result is sent | No error frame to a gone client |
| Internal error | A stage throws, or the model refuses | One terminal error frame with a stable code | Stage name and message never reach the client |
| Timeout | Generation exceeds the application deadline | `GENERATION_TIMEOUT` terminal frame and abort | Deadline stays below the host limit |
| Safety refusal | Goal classified self-harm-adjacent | Terminal refusal with its route, no mission content | Raw model output never exposed |
| Boundary enforcement | Any file under `apps/web/src` | Imports resolve only to `@zandegi/api/client`, `@zandegi/core/contracts` and presentation packages | Lint fails naming the offending import |

</frozen-after-approval>

## Code Map

- `packages/api/src/index.ts` — scaffold (`export {}`). Becomes the server surface: the generation use case plus its port interfaces. Deps already present: `@trpc/server`, `inngest` — leave both unused here.
- `packages/api/package.json` — `exports` is `{".": "./src/index.ts"}` only. Add a `./client` subpath; packages are consumed as TypeScript source (`transpilePackages` in `apps/web/next.config.mjs` lists `@zandegi/core` and `@zandegi/ai`), so update that list to match the new import graph.
- `packages/core/package.json` — same single-export shape. Add a `./contracts` subpath exposing the already-client-safe pieces the web needs (`goal-types`' `GoalType`, `percentageAllowed`, `progressDisplayAllowed`). Story 1.4 fills this surface out; do not pre-empt it.
- `packages/ai/src/types.ts:119-131` — `ScoredStep.baseXp`, `ScoredChapter.completionXp`, `ScoredMission.completionXp` are the only XP carriers; delete them. `:193-213` — `MissionGeneratedEvent` and `PipelineResult` are the fabricated-event shape. `StageName` (9 members) includes `score` and `persist`.
- `packages/ai/src/pipeline.ts:192` — the `score` stage call; `:228-241` — the `persist` stage that invents `type: "MissionGenerated"` and `occurredAt: new Date().toISOString()` and persists nothing. `:80,:238` — `Date.now()` for `generationMeta.totalMs`.
- `packages/ai/src/stages/07-score.ts` — the whole deterministic scoring stage, including an unused `ScoreContext` whose `difficultyPrior`/`currentStreakDays`/`rarityScore` are never read (`scoreMission` ignores its second argument). Remove it from the pipeline; `@zandegi/core`'s `stepBaseXp`/`chapterCompletionXp`/`missionCompletionXp` stay where they are.
- `apps/web/src/app/api/generate/route.ts` — 260 lines of bounded-body validation, SSE framing, abort and timeout handling that already works. Keep this machinery; replace only `generateMission` (`:3`, `:215`) with the API use case, and re-source `GoalInput`/`StageEvent`.
- `apps/web/src/app/generate/sse.ts:14-78` — hand-rolled runtime guards duplicating AI shapes, including `typeof mission.completionXp === "number"` at `:72-73`. Must validate the new contract instead.
- `apps/web/src/app/generate/generator-state.ts:1,8,23-33` — holds `chapters: ScoredChapter[]` and a `STAGE_ORDER` literal array duplicating `StageName`.
- `apps/web/src/components/mission-review.tsx:41` — renders `+{step.baseXp} XP`; `:55` imports `percentageAllowed` from `@zandegi/core` root; `:88-92` copy asserts "XP and difficulty come from fixed rules" and that the result is not saved.
- `apps/web/src/components/mission-review.test.tsx:19,25,40` — fixture hardcodes `completionXp: 400`, `100`, `baseXp: 30`; no assertion reads the rendered XP, so the removal will not fail a test on its own.
- Also importing AI types, type-position only: `apps/web/src/app/generate/generation-flow.ts:1`, `apps/web/src/app/generate/page.tsx:5`.
- `eslint.config.js:28-45` — Story 1.2's boundary block. Extend the same mechanism to forbid app imports of `ai`/`db`/`economy`/`tools`; `tooling/import-boundary.test.ts` is where that gets pinned.

## Tasks & Acceptance

**Execution:**
- [x] `packages/ai/src/types.ts`, `packages/ai/src/stages/07-score.ts`, `packages/ai/src/pipeline.ts`, `packages/ai/src/index.ts` — drop the three XP fields, delete the `score` and `persist` stages and the `MissionGeneratedEvent`/`PipelineResult` shapes, narrow `StageName` to the seven content stages, and return a validated draft plus grounding, safety and model metadata — no event, no clock-derived `occurredAt`.
- [x] `packages/api/src/**` — add the generation use case and its port interfaces (clock, id, cancellation, knowledge, persistence), orchestrating the `ai` draft into the client-safe result. The persistence port is defined and injected but no-op.
- [x] `packages/api/package.json`, `packages/api/src/client.ts` (or equivalent) — expose `@zandegi/api/client` carrying only the client-safe request, result, progress and error contracts.
- [x] `packages/core/package.json` — add the `./contracts` subpath for the client-safe pieces web consumes.
- [x] `apps/web/src/app/api/generate/route.ts`, `apps/web/next.config.mjs` — call the API use case instead of `generateMission`, injecting the ports; keep the existing validation, SSE, abort, timeout and error-code behaviour intact.
- [x] `apps/web/src/app/generate/sse.ts`, `generation-flow.ts`, `generator-state.ts`, `page.tsx` — re-source every type from `@zandegi/api/client`, validate the new terminal frame, and derive the stage list from the contract rather than a duplicated literal.
- [x] `apps/web/src/components/mission-review.tsx`, `mission-review.test.tsx` — remove the per-step XP render, keep the time estimate marked as an estimate, correct the copy that promises XP, and re-source `percentageAllowed` from `@zandegi/core/contracts`.
- [x] `eslint.config.js`, `tooling/import-boundary.test.ts` — forbid `apps/**` importing `ai`, `db`, `economy` or `tools`, and pin it with a test the way the `legacy/` boundary is pinned.
- [x] `packages/api/src/**.test.ts` — cover the use case's happy path, a validation failure, a cancellation and an internal error, asserting the client-safe result or stable code and that no XP field is present.
- [x] `docs/BUILD-LOG.md` — record the seam, the removed stages, what `@zandegi/api` now owns, and the exact next step.

**Acceptance Criteria:**
- Given any file under `apps/web/src`, when its imports are inspected and lint runs, then nothing resolves to `ai`, `db`, `economy`, `tools` or server-only `core` policy in runtime or type position, and the restriction fails lint when violated.
- Given a generation request, when the web adapter handles it, then it calls exactly one API-owned use case, and that use case owns orchestration while `ai` contributes only validated draft content.
- Given generation needs a clock, identifiers, cancellation or persistence, when those are used, then each arrives through an explicit injected port and no authoritative timestamp, identity or event originates inside `ai`.
- Given a completed generation, when the result is inspected end to end, then no XP, rarity, difficulty or priority number appears in the AI output, the public contract or the preview UI, and no `MissionGenerated` event is created anywhere.
- Given the existing verification gate, when `pnpm verify` runs, then every stage passes including the new API use-case tests, and the generate flow still streams progress and one terminal result.

## Implementation Notes

- Audit of the implementation found AC3 unsatisfied: `grounding.ts` still defaulted `now` to
  `new Date()`, and `pipeline.ts` called `validateMissionGrounding(draftMission)` at all three
  sites, so source-freshness was judged against an ambient clock inside `ai` rather than the one
  request-scoped instant. The use case took `startedAt` from the clock port but passed it only to
  the knowledge port. Fixed by making `asOf` a required member of `GenerateMissionDraftOptions`,
  threading it into the three grounding calls, removing the three `= new Date()` defaults in
  `grounding.ts`, and passing `startedAt` from the use case. `onEvent` became explicitly nullable
  rather than optional, because a required parameter cannot follow an optional one.
- The drift was possible because `MissionDraftGenerator` in `generate-mission.ts` declared its own
  looser options shape (`options?: { signal? }`) instead of matching the function it defaults to.
  It now declares `asOf` as required, so `ports.draftGenerator ?? generateMissionDraft` fails to
  typecheck if the two ever diverge again.
- `packages/ai/src/pipeline.test.ts` wraps the real `generateMissionDraft` with a fixed instant
  rather than editing fourteen call sites, and `generate-mission.test.ts` now asserts the same
  instant reaches both the knowledge port and generation.

## Spec Change Log

## Review Triage Log

Single-layer review (verification-gap only) at the user's instruction; the blind-hunter and
edge-case layers were skipped. Gap findings arrive pre-verified; the `Other findings` and the
AC1 question were verified here.

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | Pipeline's use of the injected `asOf` is unpinned | medium | Demonstrated: replacing all three `options.asOf` arguments with `new Date()` left all 57 `@zandegi/ai` tests passing, so the AC3 fix can regress silently. The required parameter is satisfied by `new Date()`, so types do not help. | patch |
| 2 | `toProgress` strips a stage error's `detail`, unasserted | medium | No `mapping.test.ts` exists and no test builds an error event carrying `detail`; deleting the error branch keeps every test green, which would write stage/model text into a client-visible SSE frame. | patch |
| 3 | The route's `GenerationError` branch is never exercised | medium | The only failure test rejects with a plain `Error`, whose diagnostic is the constant "non-api failure"; adding `diagnostic` to the emitted frame would still pass. The `GenerationError` path is the one that fires in production. | patch |
| 4 | Apps still read server-only `@zandegi/core` policy | medium | Confirmed directly: `builder-state.ts:1` imports `VERIFICATION_METHODS`/`verificationMult` and renders `+{stepXp(step.proof)} XP` at `builder/page.tsx:274`; `domain-art.ts:1` and `demo-data.ts:1` also import core root. The new rule covers only `ai`/`db`/`economy`/`tools`, so AC1's "server-only core policy" clause has neither a rule nor a test. | defer |
| 5 | `redactDiagnostic` skips strings under three characters | low | Confirmed: `parseGenerateMissionRequest` accepts any non-empty goal, so a one- or two-character goal reaches the server log unredacted. Fix is a direct deletion of the length guard. | patch |
| 6 | `sse.ts` validates chapter `steps` only as `Array.isArray` | low | Real: `mission-review.tsx` dereferences `step.guide.approach` and `step.verification`, so a malformed terminal frame passes the guard and throws during render. Not a regression — the previous guard was weaker — and frames come from our own server, so it is unlikely in everyday use while the fix adds validation branches. | defer |
| 7 | A client disconnect is logged as `GENERATION_FAILED` | low | Confirmed at `route.ts:193`: an ordinary abort reads as a generation failure in the log the spec's own verification step tells the developer to inspect. One-line correction. | patch |

**AC1 is not fully satisfied.** Four of the five surfaces it names are enforced and pinned
(`ai`, `db`, `economy`, `tools`); "server-only `core` policy" is not. Closing it needs `DOMAINS`
added to the contracts subpath — which story 1.4 owns — and a product decision about whether the
builder screen may compute XP client-side from published formulas at all. Recorded rather than
quietly marked done.

## Design Notes

No tRPC procedure is added. AD-2 requires apps to call API use cases through `@zandegi/api/client`; it does not require that call to cross a tRPC transport, and generation is a long streamed response rather than a request/response procedure. The web route stays the adapter and invokes the use case in-process, which keeps one hop and preserves the existing 25-second deadline handling. tRPC earns its place when there are ordinary query/mutation procedures to serve.

The XP removal is subtler than "stop the model inventing numbers". Stage 07 already computed XP deterministically from `@zandegi/core`, so the arithmetic was never the problem — the input was. `stepBaseXp(step.estimatedMinutes)` takes a number the model wrote, so a model that inflates an estimate inflates the XP. Removing XP from generation output, rather than recomputing it more carefully, is what makes law 3 true: XP exists only once a completion event is accepted. `estimatedMinutes` survives as a planning estimate because the user needs to know roughly how long a step takes.

Dropping `score` and `persist` takes the pipeline from nine stages to seven, which is visible — the generate screen lists stages as they complete. That is intended: the removed stages were a number the server should not promise and an event that was never written.

`@zandegi/core/contracts` is added as a subpath with only what the web already consumes. Story 1.4 owns defining the full contract surface, so this story opens the door without furnishing the room.

## Verification

**Commands:**
- `pnpm verify` — expected: exit 0, every stage green, including the new API tests.
- `pnpm lint` after adding `import type { ScoredChapter } from "@zandegi/ai"` to a web file — expected: non-zero, naming the file and the forbidden package. Revert.
- `grep -rn "@zandegi/ai\|@zandegi/db\|@zandegi/economy\|@zandegi/tools" apps/web/src` — expected: no matches.
- `grep -rni "baseXp\|completionXp\|MissionGenerated" packages/ai/src apps/web/src` — expected: no matches.
- With a real `ANTHROPIC_API_KEY` in `.env`, `pnpm --filter @zandegi/web dev`, then submit a goal at `/generate` — expected: stages stream, a mission renders, no XP number appears beside any step, and the time estimate reads as an estimate.
- Disconnect mid-generation (close the tab), then check the server log — expected: the run aborts, and no terminal result is recorded as delivered.
