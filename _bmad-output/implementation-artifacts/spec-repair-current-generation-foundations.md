---
title: 'Repair current generation foundations'
type: 'bugfix'
created: '2026-09-25'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f329e60eb7f27ffd607e1fdfcfda8475fd0fb340'
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/docs/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current mission-generation demo has no reproducible aggregate verification path, accepts pathological requests, reports streamed failures as success, exposes internal errors, and can emit content before grounding and safety validation. Public numeric helpers also permit non-finite values to corrupt scoring.

**Approach:** Preserve the existing scoring fixes, add explicit verification commands and CI, validate and bound the web protocol, propagate cancellation through paid model calls, and make grounding and safety exact and fail-closed before any chapter content is emitted.

## Boundaries & Constraints

**Always:** Keep the pnpm monorepo canonical and legacy independently npm-verified; preserve finite-input formulas and current uncommitted scoring fixes; use stable public error messages; validate all rewrite targets before mutation; emit chapter content only after grounding and safety succeed; retain deterministic tests with mocked model calls.

**Never:** Move `legacy/` into the pnpm or Vitest workspace; modify legacy product code; claim citations are factually verified; silently drop unsafe/ungrounded content; add persistence or authentication to pure core; expose raw exceptions; regenerate either lockfile or change model routing.

**Decision:** `/api/generate` is disabled by default in production. It may run in production only when an explicit environment flag enables the temporary unauthenticated demo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Valid generation | Bounded JSON and clean model output | Safe chapters stream, followed by one result | Stable SSE framing |
| Invalid request | Wrong media type, malformed/oversized JSON, unknown fields, invalid limits | No pipeline call | Stable 4xx JSON code |
| Client cancellation/timeout | Request closes or deadline expires | Same signal aborts model work; no further writes | Safe terminal behavior |
| Pipeline failure | Internal exception contains sensitive details | No detail leaks | Generic error code plus request ID |
| Unsafe/ungrounded rewrite | Missing, duplicate, unknown or still-invalid rewrite | No chapter or event emitted | Stage fails closed |
| Invalid score | NaN or infinity reaches a public numeric helper | No corrupt numeric result | Throw `RangeError` |

</frozen-after-approval>

## Code Map

- `package.json`, `.github/workflows/verify.yml` — separate canonical and legacy verification; use Node 22, pnpm 12.3.4 and frozen lockfiles.
- `pnpm-workspace.yaml`, `vitest.workspace.ts`, `legacy/package-lock.json` — preserve as independent boundaries; do not merge.
- `packages/core/src/scoring/{xp,levels,rarity}.ts` and tests — add finite guards without reverting user-owned fractional/max-level/headline edits.
- `apps/web/src/app/api/generate/route.ts` and new route tests — bounded strict JSON, safe SSE errors, request IDs, cancellation and production gate.
- `apps/web/src/app/generate/page.tsx`, new `sse.ts` and tests — terminal-message parser; never convert errors or premature EOF to done.
- `packages/ai/src/router.ts`, model-backed stages and `pipeline.ts` — thread `AbortSignal`; validate before chapter-bearing events.
- `packages/ai/src/{types,schemas,grounding}.ts`, `stages/08-safety.ts` — server-owned rewrite IDs and exact field locations.
- `packages/ai/src/pipeline.test.ts`, grounding/safety tests — failed rewrites emit no content; event order proves safety-before-streaming.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `.github/workflows/verify.yml` — add current/legacy verification commands and independent CI jobs.
- [x] `packages/core/src/scoring/*` — guard every public numeric input and aggregate; extend boundary tests.
- [x] `packages/ai/src/*` — propagate abort signals, introduce field-aware findings and exact rewrite IDs, fail closed, and delay chapter emission.
- [x] `apps/web/src/app/api/generate/*` — implement strict bounded input parsing, production gate, safe errors, timeout/cancellation and route tests.
- [x] `apps/web/src/app/generate/*` — extract/test SSE consumption and correct terminal UI state.
- [x] Workspace manifests/config — add only direct dependencies and test discovery needed by the new web tests.

**Acceptance Criteria:**
- Given either lockfile, when CI installs it, then current and legacy verification run independently without changing workspace membership.
- Given any public scoring helper, when a non-finite number is supplied, then it throws and every finite result remains unchanged.
- Given a rewrite response that is incomplete, duplicated, unknown or still unsafe/ungrounded, when generation runs, then it emits no chapter-bearing event or mission event.
- Given valid output, when progress is observed, then all chapter-bearing events occur after successful grounding and safety events.
- Given request cancellation or timeout, when a model stage is active, then its exact `AbortSignal` is aborted and later stages do not run.
- Given any internal secret-bearing error, when the route responds, then neither progress nor terminal SSE data contains it.

## Implementation Notes

- The route caps request bodies at 16 KiB, goal text at 2,000 characters, location at 200
  characters, timezone at 100 characters, and weekly time budgets at 1–10,080 whole minutes.
- A single route-owned abort controller links the 25-second deadline and client disconnect to the
  exact signal passed through the pipeline and Anthropic SDK request options.
- No dependency or lockfile changes were required for web tests; the existing root Vitest dependency
  discovers `apps/web/vitest.config.ts`.
- Review fixes added a hard public deadline, pre-abort handling, strict terminal SSE validation,
  final post-safety grounding, preserved redaction audit data, and direct coverage of every rewrite target.
- `_bmad/render/**` is excluded from ESLint because the generated workflow cache has restricted ACLs
  and is not application source.

## Spec Change Log

- 2026-09-25: Implemented all execution tasks without changing the approved intent or boundaries.

## Review Triage Log

| Finding | Verdict and evidence | Route |
| --- | --- | --- |
| blind: route timeout only aborts and awaits | medium — an abort-ignoring operation can keep the SSE open past the advertised deadline | patch |
| blind: pre-aborted request does not abort pipeline controller | medium — abort listeners do not replay, so generation starts for a disconnected request | patch |
| blind: CR/LF split across chunks breaks SSE framing | medium — per-chunk normalization leaves a cross-chunk `\r\n\r\n` delimiter unsplit | patch |
| blind: SSE reader is not cancelled/released on parser failure | medium — malformed early content can leave the fetch and server work active | patch |
| blind: parsed SSE JSON is cast without shape validation | medium — malformed terminal payloads can throw `TypeError` or produce false success | patch |
| blind: safety rewrites are not grounded again | high — a safety rewrite can introduce an unsourced hard claim that is then emitted | patch |
| blind: mission/chapter titles and exit conditions are outside grounding | medium — real, but this validator scope predates the story and was not expanded by it | defer |
| blind: mission/chapter titles and exit conditions are outside safety | medium — real, but this validator scope predates the story and was not expanded by it | defer |
| blind: whitespace-only rewrite text passes schema | medium — it can erase required content while appearing to resolve a finding | patch |
| blind: one 1,536-token rewrite response may not fit the theoretical maximum issue set | low — fail-closed behavior is safe and the extreme is unlikely; batching adds substantial complexity | reject |
| blind: successful safety rewrite loses initial redactions | medium — replacing the initial result discards the persisted audit trail | patch |
| blind: `professionalFrameApplied` reports classification rather than inserted content | medium — real pre-existing behavior; actual framing requires a product/content decision | defer |
| blind: CI configures pnpm cache before pnpm exists | medium — a clean GitHub runner can fail before dependency installation | patch |
| edge: pre-aborted request | medium — independently confirms the blind finding | patch |
| edge: timeout can remain open | medium — independently confirms the blind finding | patch |
| edge: rejected oversized-body cancellation changes the public error | medium — `reader.cancel()` rejection is caught as invalid JSON | patch |
| edge: cross-chunk CR/LF delimiter | medium — independently confirms the blind finding | patch |
| edge: malformed/null result can be accepted | medium — independently confirms missing runtime SSE validation | patch |
| edge: whitespace-only rewrite | medium — independently confirms the schema gap | patch |
| edge: banned phrase split between distinct structured fields | false — fields are displayed as separate strings and no execution path concatenates them into one instruction | reject |
| edge: `Math.max(...chapterAwards)` can exceed argument limits | low — public aggregate accepts arbitrary arrays and a reducer is a direct safer equivalent | patch |
| edge: fractional finite XP changed from baseline | false — this was an approved pre-task user change explicitly preserved by the frozen intent | reject |
| verification: cancellation is tested only at the first mocked stage | medium — later stage and SDK forwarding could regress while current tests stay green | patch |
| verification: exact rewrites lack setter coverage outside approach | medium — title and indexed array setters can regress without a test failure | patch |
| verification: validation error codes/messages are not pinned | low — the browser consumes this stable public contract and status-only assertions miss drift | patch |
| verification-other: cross-chunk CR/LF delimiter | medium — reproduced by the reviewer and matches the blind finding | patch |
| verification-other: pre-aborted request | medium — independently confirms the route gap | patch |

## Design Notes

Rewrite issues carry a server-generated `issueId` mapped to one exact text field (`title`, guide scalar, or guide array item). The model returns only `{ issueId, rewrittenText }`. The whole ID set is checked before applying any mutation. Multiple detections in one field become one issue. One rewrite attempt is allowed; residual findings reject generation.

Until per-chapter validation is designed, progressive chapter events are emitted as a safe batch after mission grounding and safety pass, immediately before persistence/event construction.

## Verification

**Commands:**
- `pnpm verify:current` — lint, canonical typecheck and canonical tests pass.
- `pnpm verify:legacy` — legacy typecheck and 194-test regression suite pass.
- `pnpm verify` — both independent verification paths pass.
- `pnpm --filter @zandegi/web build` — production route and UI compile.

**Observed 2026-09-26 after review fixes:** canonical lint, all 10 canonical typechecks, and 164 tests
passed; legacy typecheck and 194 tests passed; the web production build passed. Both lockfiles were
unchanged. Next emitted only its existing warning that the Next ESLint plugin is not configured.
