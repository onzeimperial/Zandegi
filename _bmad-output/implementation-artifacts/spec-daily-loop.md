---
title: 'Daily loop: steps by day, gentle recovery, daily reminder'
type: 'feature'
created: '2026-11-12'
status: 'in-review'
baseline_commit: '80a46a929800185f6bfc7b08abbefd3d9a2ec96a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-own-the-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After spec A, Today shows each mission's next step, but nothing says how much belongs to today, a missed day has no defined outcome, and nothing brings the person back. This is spec C of the thin individual MVP due within a week. It builds on spec A's stable step IDs and `/today`.

**Approach:** Simplified Stories 3.1 and 3.2, plus a reminder:
1. A pure planner assigns undone steps to the person's local days, sized to their weekly time budget. Today shows today's steps and the next few days.
2. After a missed day, unfinished work moves forward with no penalty. The daily load adapts to recent completion.
3. A once-a-day reminder by email over Gmail SMTP.

## Boundaries & Constraints

**Always:**
- **Local days.** Day boundaries use the mission's `goalContext.timezone`. If that is missing, use the browser's zone sent with the request, checked with `isSupportedTimezone`. If neither exists, use UTC and keep `localDate`'s existing behaviour.
- **Pure arithmetic.** Day placement, rollover and load adaptation are pure functions in `packages/core/src/schedule/`. Each takes today's local date, the zone, steps with `estimatedMinutes`, and completion instants. None reads a clock or a store. Each has tests, including DST and midnight boundaries.
- **A stable today.** Steps completed earlier the same local day count toward today's capacity, so finishing today's steps does not pull tomorrow's in. Every day gets at least one step, even when that step is longer than the day's capacity.
- **Order.** Steps keep spec A's chapter and step order, including the person's reorders. Person-written steps are scheduled but never resized.
- **No XP.** Scheduling, missing a day, rescheduling and reminders never write or change a ledger event or an XP rule. Rewards belong to spec B.
- **Law 8.** No streak counts, no "missed" or "overdue" labels, no countdowns. The copy after a gap is welcoming. Reminders never mention loss, never repeat on the same day, and are never sent once today's steps are done. No purchase prompt appears anywhere in this loop.
- **Ownership.** Only the owner sees their schedule. Email addresses and step text never appear in logs or incidents. Any trigger route verifies a secret and refuses everything else. Migrations are additive.

**Never:** A calendar or time-of-day blocks, external calendars, busy periods (Story 8.3), recovery chapters, rewriting step text to resize it, boss scheduling, population tuning (EWMA), or social features.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Spread | 600 min/week, five 40-min steps undone | Today holds two steps (about 86 min a day). The rest fall on the following days | N/A |
| Done for today | Today's steps completed | Today says it is done and shows tomorrow. Nothing new is pulled in | N/A |
| Missed day | Yesterday's steps not done | They lead today with neutral copy. XP unchanged | N/A |
| Long step | One 180-min step, 60 min/day | Fills today on its own | N/A |
| Midnight | 23:30 and 00:30 in Sydney | Different local days, even where the UTC date is the same | N/A |
| No budget | `goalContext` has no weekly budget | 30 minutes a day | N/A |
| Reminder, done | Every step for today completed | No reminder sent | N/A |
| Forged trigger | Trigger route called without the secret | Nothing sent | 401 |

**Decisions by the human (2026-11-12):**
- **Reminder channel:** one daily email sent over Gmail SMTP with an app password. No domain is needed and it reaches both testers.
  - Credentials live in server env vars and are never logged.
  - It is opt-in per person, with a visible way to stop.
  - The recipient is the person's verified sign-in email, stored at opt-in.
  - If the email credentials are unset, reminders stay off and the app keeps working.
- **Trigger:** one Vercel cron job a day at a fixed hour (Hobby allows once a day, within the hour). The cron route accepts only Vercel's cron secret and opens no other route. Inngest waits for Epic 5.
- **Placement:** undone steps spread automatically across every day from the weekly budget, 30 minutes a day if it is unset. Nothing new is stored for placement.
- **Missed day:** work rolls forward quietly with one welcoming line on the first visit after a gap. No penalty, no streak shaming (law 8).
- **Adapting:** use Story 3.2's thresholds. More than 0.85 of capacity completed over the last 7 days adds 15%; less than 0.45 removes 20%. Only the daily load changes, never the steps.
- Subagents may implement and review.

</frozen-after-approval>

## Code Map

- `packages/core/src/schedule/` (new) -- `localDay`, `planDays`, `adaptCapacity`, and their tests. Export from `core/src/index.ts`.
- `packages/ai/src/person-context.ts` -- `localDate`. Reuse its semantics, or move it into core.
- `packages/api/src/generation/request.ts` -- `isSupportedTimezone`, and `goalContext` shape (timezone, `weeklyTimeBudgetMinutes`).
- `packages/api/src/progress/fold.ts`, `ledger.ts` -- completed step IDs and `recordedAt`. Read only.
- `packages/api/src/client.ts` -- add a `TodayPlan` contract.
- `packages/api/src/plan/` (spec A) -- add a `planToday` use case.
- `apps/web/src/app/today/` (spec A) -- render the days.
- `apps/web/src/middleware.ts`, `lib/route-guard.ts` -- let the cron route through Clerk. The route checks its own secret.
- `vercel.json` -- the `crons` entry.
- `packages/db/*` -- only for a reminder opt-in (`ReminderPreference`), if email is chosen.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/schedule/*` -- the pure planner, rollover and adaptation, with tests for every matrix row -- trustworthy arithmetic.
- [x] `packages/api/src/client.ts`, `plan/plan-today.ts` -- `TodayPlan` (today's step IDs, the next 3 days, a done flag, and whether this is the first visit after a gap), built from the mission, the fold and the zone -- one use case for web and the reminder.
- [x] `apps/web/src/app/today/*` -- day sections with loading, empty, error and 375px states -- shows the schedule.
- [x] `apps/web/src/app/api/cron/reminder/route.ts`, `vercel.json`, the channel adapter and the opt-in -- the daily send, with happy-path and auth-failure tests.
- [x] `docs/BUILD-LOG.md`, `README.md` (new environment variables).

**Acceptance Criteria:**
- Given a mission with a timezone and a budget, when the person opens Today on two consecutive days without completing anything, then the same steps lead each day, nothing says "missed", and XP is unchanged.
- Given the reminder trigger runs, when a tester has steps left today and has opted in, then exactly one neutral reminder links to `/today`.
- Given `pnpm verify` on a clean checkout, then it passes with no network or credentials.

## Implementation Notes

- Node 24.11.0 and `pnpm` is not on PATH: run `npx --yes pnpm@12.8.2 <args>`. The dev server is `node .\node_modules\next\dist\bin\next dev`, run from `apps\web`. A real `ANTHROPIC_API_KEY` is in gitignored `apps/web/.env.local`; never print it.
- Commit locally after each working piece with a conventional message and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Spec Change Log

## Review Triage Log

Loop 1. B = blind, V = verification gap, E = edge case. Verification-gap gaps arrive pre-verified.

| ID | Finding | Verdict | Route | Evidence |
|----|---------|---------|-------|----------|
| B1, V-o1, E4, E15 | The reminder's claimed day and the plan's day can use different zones | medium | patch | `reminders.ts` claims `localDay(now, reminder.timezone)` while `planToday` uses the mission's zone first. |
| B2, E5 | The copy promises "each morning" from one fixed UTC cron | low | patch | Hobby allows once a day; the decision was a fixed hour. Copy-only fix. |
| B3, E3 | An uninvited person, or an old address, keeps getting email | medium | patch | The sweep never re-checks `ZANDEGI_ALLOWED_EMAILS`. |
| E6 | Opt-in without a zone wipes the stored zone | low | patch | The Postgres upsert writes `timezone: undefined`. A direct correction. |
| B8 | One malformed mission takes Today down; the fallback branch is unreachable | medium | patch | `planToday` has no try/catch per mission. |
| B9, E13 | A new mission is cut back after its first quiet day | medium | patch | The adaptation window can be one day; the decision says the last 7 days. |
| E9 | "Welcome back" shows the morning after a mission is created | low | patch | No guard on the start day. A direct correction. |
| E12 | After "Done for today", Today has no way to start the next step | medium | patch | The old current-step card was replaced. |
| V-o2 | Today's steps are not in path order | low | patch | `planDays` puts done steps first, contradicting its own type docs. |
| B15, V-o3, E10 | `TimezoneSync` can refresh repeatedly | medium | patch | The check is `cookie.includes("zandegi_tz=")`; a stale cookie never matches. |
| E2 | SMTP has no timeouts inside a time-limited function | low | patch | Set the transport timeouts. A direct correction. |
| B11 | Failure causes are lost | low | patch | `catch {}` drops the class and code; `describe()` exists. |
| V1 | The Today page is never rendered in a test | medium | patch | Filed evidence. |
| V2 | `withToday` loading is never run | medium | patch | Filed evidence. |
| V3 | The cron route's 503 path is untested | low | defer | Filed disposition; the layers below it are tested. |
| B4 | The stored zone is never refreshed | low | rejected | Travel is rare for this test; the mission's own zone usually decides. |
| B5 | No one-click unsubscribe | low | rejected | The spec decision asks for a visible way to stop, which Today provides; two recipients. |
| B6 | Foreign key restricts deletion | low | rejected | No delete feature yet (Story 4.3). |
| B7, E7 | Redis offers reminders that fail | low | rejected | Dormant store. |
| B10, E14 | "Welcome back" repeats on alternate days and all day | low | rejected | Visits are not stored, by decision; a gap is a gap. |
| B12, E1 | No time budget; the 500 cap is silent | low | rejected | Two people. |
| B13 | Shown minutes differ from planned minutes | low | rejected | Cosmetic. |
| B14 | Analytics events are missing | low | rejected | `docs/ANALYTICS.md` does not exist. |
| B16 | The law-8 word scan is brittle | low | rejected | A test-quality matter with no user harm. |
| E8 | A junk `ZANDEGI_APP_URL` breaks links | low | rejected | Operator configuration, visible at once. |
| E11 | A NaN estimate is shown | false | rejected | Estimates are validated integers. |

## Design Notes

The schedule is derived on every read, not stored, so missing a day needs no job. Today's capacity is `adaptCapacity(base, last7)`, where `base` is the weekly budget divided by 7. Steps completed today fill it first, then undone steps in order until the next step would overflow. Later days repeat the same rule. A cron route secured by `CRON_SECRET` calls `planToday` for each opted-in person. It sends only when today has undone steps.

## Verification

**Commands:**
- `npx --yes pnpm@12.8.2 verify` -- expected: format, lint, typecheck, tests and build pass offline.

**Manual checks:**
- Set the device clock past local midnight. Today should roll over, yesterday's work should lead with welcoming copy, and the layout should hold at 375px.
- Trigger the cron route locally, once with the secret and once without. Expect one send with the secret and a 401 without it.
