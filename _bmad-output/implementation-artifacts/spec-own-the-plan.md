---
title: 'Own the plan: Today screen, plan editing, log anything'
type: 'feature'
created: '2026-11-12'
status: 'in-progress'
baseline_commit: '9ea8b2d4c4685c0ae0fcef443d1cb112f59764ae'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-two-person-mvp-test.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A generated plan is fixed. A person cannot fit it to their life, cannot record progress that wasn't in the plan, and has no single place showing what to do now. This is spec A of a thin individual MVP due within a week; spec B (boss fights) and spec C (daily loop) build on it.

**Approach:** Build three things in one release:
1. Stable chapter and step IDs (Story 7.2), so progress belongs to the step itself and not its position.
2. Plan editing (Story 8.1) and quick logging (Story 8.2 lite).
3. A Today screen showing each active mission's current step, with quick log.

**Decisions by the human (2026-11-12):**
- Spec A is three bundled pieces, kept as one spec at about 2,200 tokens. Individual only. Deadline within a week. Subagents may implement and review.
- **Added steps pay no XP** until spec B's reward policy exists. They must be done to finish their chapter. Chapter and mission completion bonuses are computed from the generated steps the person actually completed, so adding or deleting steps cannot raise a bonus.
- **Today is the new home.** `/today` is where a signed-in person lands, and the nav is Today, Path and New mission. Path keeps the full mission view.

## Boundaries & Constraints

**Always:**
- **Stable IDs.** Every chapter and step has an ID derived from its generated position, and an ID is never reused. A pure upcaster turns old index-based events and missions into IDs, with no DB, clock or calculator call. Folded XP, completion and the next step for existing data are identical before and after. For a position-derived ID, the claim key equals today's legacy key, so a retry across the deploy pays once.
- **Edits.** Editing a step means rewriting its title or guide text, reordering steps within a chapter, adding steps, or deleting steps. A chapter title may be renamed. Each edit goes through one API use case with a mission version check; a stale edit gets a stable conflict.
  - An edited generated step loses its sources, is marked as the person's own, is never sent to a model, and skips grounding (approved 2026-11-03).
  - Paid awards never change. Editing never writes, rewrites or removes a ledger event (laws 3 and 4).
- **Logs.** A log is a one-line note or a number with an optional unit. It is filed under the current chapter, can be moved to another chapter of the same mission, uses no model, and pays no XP. Log text is personal content: never in logs, incidents or the ledger.
- **Today.** Today lists each mission's current step, with a link to complete it and a quick log. It has empty, loading, error and 375px states (CLAUDE.md section 6).
- **Ownership and storage.** Only the owner can read or edit a mission or log. Apps never import `@zandegi/db`. Migrations are additive only.

**Never:**
- Adding or removing a chapter (stable error). Editing a chapter's exit condition, which belongs to spec B.
- Photo logs (Story 2.4 is not built). Export, delete, scheduling, reminders, boss fights, the reward policy (Story 7.1) or any `neutral-v1` formula change. Story 2.2's atomic ledger.
- Social features of any kind.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Legacy data | Mission and events from before this release | Same XP, same completed steps, same next step | N/A |
| Reorder | Move an undone step above a done one | Done stays done; the next step is the first undone in the new order | N/A |
| Delete paid step | Delete a completed step | XP unchanged; the step leaves the path | N/A |
| Stale edit | Edit with an old version | Nothing saved | `PLAN_EDIT_CONFLICT` 409 |
| Chapter add/remove | Request to add or remove a chapter | Nothing saved | `INVALID_REQUEST` 400 |
| Re-add after delete | Delete a step, add a similar one | New ID; it can never collect the old step's claim | N/A |
| Log | Note under the current chapter | Saved, shown on Today; no XP event; no model call | N/A |
| Foreign mission | Edit or log on another person's mission | Nothing saved or revealed | `MISSION_NOT_FOUND` 404 |
| Signed out / not invited | Any edit or log route | Refused | 401 / 403 as today |

</frozen-after-approval>

## Code Map

- `packages/api/src/client.ts` -- `MissionStep`/`MissionChapter`/`MissionDraft` (no IDs yet), `StoredMissionView`, error codes (append `PLAN_EDIT_CONFLICT`; never reorder).
- `packages/api/src/progress/ledger.ts` -- events keyed by `chapterIndex`/`stepIndex`; `stepClaimId`/`chapterClaimId` (line 138); `parseLedgerEvent` is where the upcaster belongs.
- `packages/api/src/progress/complete-step.ts` -- position-based completion, `nextStep`, bonus loop (lines 155-190); `neutralChapterAward(stepCount)` scales with count.
- `packages/core/src/scoring/award.ts` -- `neutral-v1`; do not change formulas.
- `packages/db/src/{store.ts,memory.ts,redis.ts,postgres.ts,store-contract.ts}`, `prisma/schema.prisma` -- add versioned compare-and-set mission update and a `MissionLog` table/methods; the shared contract suite covers memory and Postgres; Redis implements or fails clearly.
- `packages/api/src/demo-store.ts` -- port wiring.
- `apps/web/src/app/path/page.tsx`, `step/page.tsx`, `lib/guest-missions.ts` (`stepStates`, position comments) -- switch to IDs.
- `apps/web/src/components/app-shell.tsx`, `lib/route-guard.ts`, `middleware.ts`, `app/page.tsx` -- nav and landing.
- `apps/web/src/app/api/missions/[id]/*` -- route pattern to copy (origin check, session, `ACCESS_STATUS`).

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/client.ts`, `progress/ledger.ts` -- add IDs, the upcaster, ID-keyed claims, and edit and log contracts -- contract first.
- [x] `packages/api/src/progress/complete-step.ts` and a new `plan/` use cases (`editPlan`, `logProgress`, `moveLog`, `listLogs`) -- ID-based completion; added steps pay nothing; bonuses from completed generated steps only; version-checked edits.
- [x] `packages/db/*` -- migration (mission `version`, `MissionLog`), store methods, contract tests.
- [x] `apps/web/src/app/api/missions/[id]/plan`, `.../logs` routes -- happy-path and auth-failure tests each.
- [x] `apps/web` -- edit mode on the path, the Today screen, quick-log form, nav and landing.
- [x] Tests for every matrix row; `docs/BUILD-LOG.md`, `README.md` if deploy changes.

**Acceptance Criteria:**
- Given an existing deployed mission with completed steps, when this release is deployed, then the person sees the same progress and next step.
- Given a person edits, reorders and logs, when they reload on another device, then every change is there and their XP total moved only by completed steps.
- Given `pnpm verify` on a clean checkout, then it passes with no network or credentials.

## Implementation Notes

- Node 24.11.0 and `pnpm` is not on PATH: run `npx --yes pnpm@12.8.2 <args>`. The dev server is `node .\node_modules\next\dist\bin\next dev`, run from `apps\web`. A real `ANTHROPIC_API_KEY` is in gitignored `apps/web/.env.local`; never print it.
- Commit locally after each working piece with a conventional message and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Spec Change Log

## Review Triage Log

## Design Notes

**Claim keys:** a position-derived ID must reproduce `${missionId}:step:${c}:${s}`. An ID made with `c${c}s${s}` would need a key that differs from the legacy one, so pick the ID format, or a key function, that keeps them identical. Added steps take IDs from a per-mission counter that only increases.

## Verification

**Commands:**
- `npx --yes pnpm@12.8.2 verify` -- expected: format, lint, typecheck, tests and build pass offline.

**Manual checks:**
- Generate a mission, complete two steps, reorder, delete one done step, add one, log a note, and reload. XP should be unchanged by the edits, and Today should show the right next step at 375px.
