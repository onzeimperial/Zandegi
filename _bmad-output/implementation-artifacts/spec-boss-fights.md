---
title: 'Boss fights, simplified: progression-v2, chapter bosses, attempt and debrief'
type: 'feature'
created: '2026-11-12'
status: 'done'
baseline_commit: '80a46a929800185f6bfc7b08abbefd3d9a2ec96a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-own-the-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A chapter ends when its last step is ticked, and most XP comes from step-count bonuses that prove nothing changed. This is spec B of the thin individual MVP and builds on spec A (stable IDs, ID-keyed claims, plan editing, Today).

**Approach:** Ship Stories 7.1, 7.4 and 7.5, simplified:
1. Publish `progression-v2` in `@zandegi/core` for new events. Old events keep their stored amounts.
2. Each chapter's boss is a real act taken from its `exitCondition`. A person attempts it, records "done" or "not yet" and a short debrief, and the chapter closes whatever the result.

## Boundaries & Constraints

**Always:**
- **Policy.** Every tunable value and its rationale lives in one versioned config in `core`. The calculator takes only the evidence kind, the boss band and amounts already in the ledger. Model estimates and client totals are rejected. The fold never recalculates a stored amount.
- **Steps.** Generated steps pay the v2 step reward, up to a per-chapter cap counted from the ledger. Added steps pay 0, as spec A decided. No chapter or mission reward scales with step count.
- **Boss.** The boss text is the chapter's `exitCondition`, shown unchanged and labelled as the person's test. No model call is made. Before an attempt, no XP amount or percentage is shown.
- **Attempt.** An attempt is allowed once every step in the chapter is done or the person chooses to skip the rest. Skipped steps pay nothing and cannot be completed later. The debrief has four optional prompts (tips, went well, didn't go well, what I'll improve), and at least one must be answered.
- **Records.** The raw result and the debrief are deletable relational records (`BossAttempt`), are personal content, and never appear in logs, incidents or the ledger. The ledger gets a `BossResolved` event holding the attempt ID, chapter ID, band, evidence kind, XP, the `selfDeclared: true` flag and the calculator version.
- **Verification (law 3).** A boss result is `SELF`, or `ARTIFACT` using the existing `fingerprintPhoto` (the photo is checked, hashed and discarded). `METRIC`, `TIMER` and `INTEGRATION` are not accepted for bosses.
- **Payment.** Boss XP is claimed once per chapter (`${missionId}:boss:${chapterId}`). "Not yet" pays 0 and offers **try again**: a later "done" attempt on the closed chapter pays the done band once. The chapter stays closed and nothing is ever paid twice.
- **Debrief carry-over.** "What I'll improve" becomes the next chapter's first step through spec A's `addStep` (an `own-N` step that pays nothing and can be removed).
- **Legacy.** Chapters that already have a `ChapterCompleted` event count as closed and offer no boss.

**Never:**
- Metric targets, intake baseline and goal number (7.3), rematch targets (7.6) or analytics (7.7).
- Changing `neutral-v1` or rewriting an old event. Photo storage. Social features. Copy that frames "not yet" as a loss.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Done | All steps done; "done" + debrief | Chapter closed; done band paid; next chapter opens with the improve step | N/A |
| Not yet | "not yet" + debrief | Chapter closed; 0 XP; try again offered | N/A |
| Try again | Later "done" on a chapter closed at "not yet" | Done band paid once | Second "done" pays 0 |
| Double submit | Same attempt sent twice | One close, one payment | N/A |
| Skip | Undone steps, person chooses skip | Attempt allowed; skipped steps unpaid and locked | N/A |
| No debrief | All prompts empty | Nothing saved | `INVALID_REQUEST` 400 |
| Too early | Undone steps, no skip | Nothing saved | `BOSS_NOT_READY` 409 |
| Cap | Chapter step XP at the cap | Further steps record 0 | N/A |
| Legacy | `neutral-v1` events and chapters | Same total and level; closed chapters stay closed | N/A |
| Foreign / signed out | Another person's mission, or signed out | Nothing saved or revealed | 404 / 401 / 403 as today |

**Decisions by the human (2026-11-12):**
- `progression-v2` values:
  - Step reward: 40 for `SELF`, 50 for `ARTIFACT`.
  - Per-chapter step-XP cap: 450.
  - Boss bands: "done" pays 400, plus 50 with a photo. "Not yet" pays 0. There is no "partly" band.
  - No target cap in v2.
  - Fixed mission reward: 1,500, paid only when every boss reaches "done", try-again included.
  - Level curve unchanged: `round(100 × n^1.6)`.
- "Not yet" pays nothing, keeps the try-again offer, and uses no shaming copy (law 8).
- Subagents may implement and review.

</frozen-after-approval>

## Code Map

- `packages/core/src/scoring/award.ts`, `levels.ts`, `index.ts` -- add `progression-v2` config and functions beside `neutral-v1`; the curve stays.
- `packages/api/src/progress/ledger.ts` -- add `BossResolved`, its parser and its claim key.
- `packages/api/src/progress/fold.ts` -- closed chapters come from `ChapterCompleted` or `BossResolved`; `nextStep` skips closed chapters; boss XP is counted.
- `packages/api/src/progress/complete-step.ts` -- v2 step award with the cap; stop writing new chapter bonuses; pay the mission reward under v2.
- `packages/api/src/client.ts` -- boss view, attempt contract, `AwardView.kind` gains `"boss"`, append `BOSS_NOT_READY`.
- `packages/api/src/plan/edit-plan.ts` -- reuse `addStep` for the improve step.
- `packages/db/prisma/schema.prisma`, `src/{store,memory,postgres,redis,store-contract}.ts` -- `BossAttempt`.
- `apps/web/src/app/path`, `step`, the Today page, `components/complete-step-panel.tsx`, `app/api/missions/[id]/*` -- boss card, attempt and debrief form, result copy.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/core/src/scoring/` -- `progression-v2` config, step, boss and mission functions with tests, and golden fixtures proving `neutral-v1` totals are unchanged.
- [ ] `packages/api/src/client.ts`, `progress/ledger.ts`, `progress/fold.ts` -- contracts, event and fold. Contracts come first.
- [ ] `packages/api/src/boss/attempt-boss.ts` (new), `progress/complete-step.ts` -- attempt, try again, skip, debrief carry-over and v2 awards.
- [ ] `packages/db/*` -- additive migration for `BossAttempt`, store methods and contract tests.
- [ ] `apps/web/src/app/api/missions/[id]/boss` route -- happy-path and auth-failure tests.
- [ ] `apps/web` -- boss card on Path and Today once a chapter's steps are done; attempt and debrief form; result screen with no loss framing; remove the builder's `+N XP`. Meet CLAUDE.md section 6 states.
- [ ] Tests for every matrix row; `docs/BUILD-LOG.md`.

**Acceptance Criteria:**
- Given a person with `neutral-v1` history, when this ships, then their total XP, level and closed chapters are identical.
- Given a mission with added steps, when it completes, then its XP equals the same mission without them.
- Given `pnpm verify` on a clean checkout, then it passes offline.

## Implementation Notes

- Node 24.11.0 and `pnpm` is not on PATH: run `npx --yes pnpm@12.8.2 <args>`. The dev server is `node .\node_modules\next\dist\bin\next dev`, run from `apps\web`. A real `ANTHROPIC_API_KEY` is in gitignored `apps/web/.env.local`; never print it.
- Commit locally after each working piece with a conventional message and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Spec Change Log

## Review Triage Log

Loop 1. B = blind, V = verification gap, E = edge case. Verification-gap gaps arrive pre-verified.

| ID | Finding | Verdict | Route | Evidence |
|----|---------|---------|-------|----------|
| B7 (law 3) | Skip, "done" and one debrief character pay 400 per chapter, then the 1,500 reward | real | rejected by the human | 2026-11-13: the human ruled this acceptable for the two-person MVP. |
| B2, E3 | A resend with the same key repeats the request's result, not the stored one | medium | patch | The `!fresh` branch echoes `request.result`. |
| B3, B4, E4, E5 | Retries add the improve step again, or lose it | medium | patch | `carryOver` runs on every retry with no check for an existing step. |
| V3 | Improve step into an already-closed next chapter is untested | medium | patch | Filed evidence. |
| B5, V-o2 | After a failed record, the ledger's attempt id points at no record | medium | patch | A resend mints a new id. Derive it from the mission and `attemptKey`. |
| B4b | `carryOver` swallows errors silently | low | patch | Bare `catch`. A direct correction. |
| B6 | The copy says the photo fingerprint is kept, but it is discarded | medium | patch | `BossResolved` stores only the evidence kind. Keep the fingerprint so the copy is true. |
| B8 | "Saved in your notes" points at notes that cannot be viewed | low | patch | No read path exists. Copy-only fix. |
| E6, V4 | The step page's next-link decision is untested and wrong for an upcoming chapter | medium | patch | `chapterOpen` leaves out `upcoming`; no executing test. |
| V1 | Mixed neutral-v1 and boss mission reward is never asserted | medium | patch | Filed evidence. |
| V2 | Resending after a failed `MissionCompleted` write is untested | medium | patch | Filed evidence. |
| E7, E8 | The same photo cannot be re-chosen; a stale "too large" alert stays | low | patch | Direct corrections. |
| V-o3 | Try again asks again to skip steps already skipped | low | patch | Direct correction. |
| B1, E1, V-o1 | The Redis store pays, then fails to record | low | rejected | Dormant driver; deployments use Postgres. The id fix above handles the Postgres failure case. |
| B7b, E9, E10 | A neutral-v1 bonus whose write failed before the deploy is never paid | low | rejected | Needs a failed write before the deploy; two testers. |
| B9 | No CHECK constraints on result or evidence | low | rejected | The values are validated in the use case. |
| B10 | Route field list drift; a photo sent with SELF is ignored | low | rejected | No user harm. |
| B11 | A step can race a "not yet" on the same chapter | low | rejected | One person acting in two places at once. |
| B12 | Analytics are missing | low | rejected | `docs/ANALYTICS.md` does not exist. |

## Design Notes

**Why one boss claim per chapter:** real-act bands are 0 or the full amount, so "pay the difference up to the top band" (7.5, 7.6) becomes "pay once". The single claim handles the cap, double submits and try again together. Exit conditions that depend on other people are shown unchanged; rewriting them is a later generation change.

## Verification

**Commands:**
- `npx --yes pnpm@12.8.2 verify` -- expected: format, lint, typecheck, tests and build pass offline.

**Manual checks:**
- Finish a chapter, attempt "not yet" with one answer, and check the chapter closes at 0 XP. Then try again with "done" plus a photo: 450 paid once, the improve step opens the next chapter, and it works at 375px.
