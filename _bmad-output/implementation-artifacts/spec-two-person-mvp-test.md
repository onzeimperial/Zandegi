---
title: 'Two-person MVP test: detailed goals, Postgres, Clerk sign-in'
type: 'feature'
created: '2026-11-04'
status: 'done'
baseline_commit: 'd97b0f3b5fbcfe8f797e0fb6edc06b750dd045e4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Zandegi-2026-09-25/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two real people cannot use Zandegi for several days. The form captures one line, so the model guesses level, deadline and time; data lives in memory or expiring Redis; the login form is fake, so identity is a single browser's cookie; and a deployed generate endpoint would let anyone spend the Anthropic budget.

**Approach:** In order: (1) optional detail fields that reach every stage that writes or classifies a plan; (2) a Postgres store on Prisma 7 and Neon behind the existing `DemoStore` seam; (3) Clerk sign-in with a server-side email allowlist and a per-person daily generation cap, with unbuilt screens hidden. One separate commit per piece.

**Decisions by the human (2026-11-04):** Clerk sign-in over cookie plus access code. All three pieces in one spec, built in sequence. Subagents may be used for review.

## Boundaries & Constraints

**Always:**
- Detail fields are optional and skippable; the ambition alone still generates. Copy asks what a person *can* put toward the goal, and nothing implies the goal is out of reach (law 8). The model may call a plan tight and never judges the person.
- Details go to the classifier as the person's exact words, delimited as data the model must not follow as instructions.
- Stated hours, target date and location override the model's inference deterministically in the pipeline.
- Detail text and location never reach the ledger, logs or incident records. Add them to the same redaction list as the goal text.
- Apps never import `@zandegi/db`, and Prisma types never leave it (AD-2). Clerk sessions are verified at the web adapter (epics, AD-7); allow and principal decisions are `@zandegi/api` use cases.
- `LedgerEntry` rejects UPDATE and DELETE by database trigger (law 4). Migrations run outside request handlers and create only new objects.
- Production fails closed: no Clerk keys or an empty allowlist disables the app's APIs; no durable store returns `STORE_UNAVAILABLE`. An allowlist match needs a verified email.
- Error codes are appended, never reordered (`client.ts`). `pnpm verify` needs no network and no credentials.
- Definition of done in `CLAUDE.md` section 6 applies to changed screens, except analytics: `docs/ANALYTICS.md` does not exist.

**Never:**
- No Story 2.2 Unit of Work, envelope, sequence or outbox; claim then append stays non-atomic behind the existing port. No guest claim (Story 4.1). No reward, economy or `core` scoring change.
- No structured baseline or goal number and no boss data (Story 7.3). No new intake fields beyond those below.
- No purchase prompt or fake urgency at the daily cap (law 8).
- No deletion of `legacy/` or of the guest and Redis code; both stay dormant and tested.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ambition only | `rawText`, no details | Generates as today | N/A |
| Full details | All fields | Plan and detail stages receive them; hours and date are not overridden by the model | N/A |
| Worrying detail | Self-harm wording only in a detail field | `support` refusal; no plan or detail call | N/A |
| Bad detail | Unknown nested key, text over 500 chars, invalid or past `targetDate` | No model call | `INVALID_REQUEST` 400 |
| Signed out | No Clerk session | Page redirects to `/`; API refuses | `SIGN_IN_REQUIRED` 401 |
| Not invited | Signed in, no verified email on the allowlist | Invite-only screen; no data; no spend | `ACCOUNT_NOT_ALLOWED` 403 |
| Two devices | Same Clerk user | Same principal, missions and XP | N/A |
| Concurrent first request | Same Clerk user, twice at once | One principal row | Upsert on unique `clerkUserId` |
| Daily cap | Over `ZANDEGI_DAILY_GENERATION_LIMIT` (default 5) per UTC day | No model call; existing missions usable | `DAILY_LIMIT_REACHED` 429 |
| Restart | Server restarted with Postgres | Missions and XP intact | N/A |
| Ledger tamper | UPDATE or DELETE on `LedgerEntry` | Rejected by the database | Trigger error |
| Database down | Query fails | Stable code; no URL or password logged | `STORE_UNAVAILABLE` 503 |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/generate/{page.tsx,request.ts,generation-flow.ts}`, `globals.css` (`.ambition-field`) -- form sends only `rawText`; holds the false "time blocks" copy and the `/builder` fixture link.
- `packages/api/src/client.ts` -- `GenerateMissionRequest`, `GENERATE_MISSION_REQUEST_FIELDS`, limits, error codes.
- `packages/api/src/generation/{request.ts,generate-mission.ts}` -- strict parser; three `[request.rawText]` redaction sites.
- `packages/ai/src/types.ts` (`GoalInput`), `pipeline.ts`, `stages/01-interpret.ts`, `02-resolve.ts` (classifier sees only the summary), `04-plan.ts`, `05-detail.ts` (receives only `currentLevel`).
- `packages/db/src/{store.ts,memory.ts,redis.ts,index.ts}` -- `DemoStore` is the seam; Postgres is a sibling. `packages/db/package.json` already pins Prisma 7.10.0.
- `packages/api/src/demo-store.ts` -- driver choice; its cache is a module variable that dev recompiles wipe (move to `globalThis`).
- `packages/api/src/identity/` -- reuse `GuestPrincipal` as the principal shape; leave guest flow intact.
- `apps/web/src/app/api/generate/route.ts`, `api/missions/[id]/route.ts`, `api/missions/[id]/complete/route.ts`, `apps/web/src/lib/guest-missions.ts` -- the four identity call sites; `ENABLE_UNAUTHENTICATED_GENERATION` gate. `MAX_BODY_BYTES` of 16 KB is too small for the new fields.
- `apps/web/src/app/page.tsx`, `auth-state.ts`, `layout.tsx`, `components/app-shell.tsx`, `routes.test.ts`, `page.test.tsx` -- fake login, nav, fixture routes.
- `eslint.config.js`, `.prettierignore`, `vercel.json`, `next.config.mjs`, `.env.example`, `README.md` -- generated-client ignores, build command, env docs. `.env.example`'s `DATABASE_URL="file:./dev.db"` is legacy, so inference must require a `postgres` scheme.

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/client.ts`, `generation/*` -- add `details` (`startingPoint`, `why`, `targetDate`, `resources`, `planAround`), limits, parser rules, past-date check via the clock, redaction of all personal fields -- contract first.
- [x] `packages/ai/src/{types,pipeline}.ts`, stages 01, 02, 04, 05 -- thread context from input, give stage 1 today's date, override stated values, add prompt rules -- details must shape the plan.
- [x] `apps/web/src/app/generate/*`, `api/generate/route.ts`, `globals.css` -- optional section (open disclosure), hours to minutes, automatic timezone, inline validation, 32 KB body limit, remove false copy and builder link -- the visible input.
- [x] `packages/db/prisma/schema.prisma`, `prisma.config.ts`, `migrations/*_two_person_test_store/`, `src/postgres.ts`, `package.json` -- `Principal` (nullable unique `tokenHash` and `clerkUserId`), `Mission` (with `goalContext` JSON), `CompletionClaim`, `LedgerEntry`, `GenerationUsage`, trigger; lazy load, sanitised errors -- durable store.
- [x] `packages/db/src/store.ts`, `memory.ts`, `redis.ts`, `store-contract.ts`, `postgres.test.ts` -- add `findOrCreateAccountPrincipal`, `claimGenerationSlot`, `goalContext`; one shared contract suite across memory and Postgres (PGlite over `pglite-socket`, real `@prisma/adapter-pg`) -- same behaviour everywhere, no network.
- [x] `packages/api/src/demo-store.ts` -- `postgres` driver, `globalThis` cache, production refuses memory -- durability cannot silently lapse.
- [x] `packages/api/src/identity/account.ts`, `generation/usage.ts` -- pure allowlist decision, account principal and cap use cases with tests -- logic stays out of the adapter.
- [x] `apps/web/src/middleware.ts`, `lib/session.ts`, `layout.tsx`, `page.tsx`, `app-shell.tsx`, the three routes, `guest-missions.ts`, `next.config.mjs` -- Clerk provider, middleware, real sign-in on `/`, returning people go to `/path`, invite-only screen, sign-out, nav reduced to built screens, fallback to guest mode only outside production without keys -- real identity.
- [x] Route and page tests -- happy path and auth failure per procedure, each matrix row -- required by CLAUDE.md section 5.
- [x] `.env.example`, `README.md`, `vercel.json`, `deferred-work.md`, `docs/BUILD-LOG.md` -- deploy steps, env docs, deferred brainstorm fields, session entry.

**Acceptance Criteria:**
- Given a signed-in allowed person, when they enter details and generate, then the mission persists in Postgres and reappears on another device after a restart.
- Given real generations with details filled in, when steps are read, then they visibly reflect the starting point and constraints.
- Given a clean checkout with no credentials, when `pnpm verify` runs, then it passes without network.
- Given the nav and `/`, when viewed signed in, then no fixture number or fake login appears.

## Implementation Notes

- Machine: Node 24.11.0 and `pnpm` is not on PATH; run workspace commands as `npx --yes pnpm@12.8.2 <args>`. A real `ANTHROPIC_API_KEY` is in `apps/web/.env.local` (gitignored; never print it). Start dev with `node .
ode_modules
extdistin
ext dev` from `appsweb`. No Docker. No Neon or Clerk credentials exist yet.
- Commit locally after each piece with conventional messages and this trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Spec Change Log

## Review Triage Log

Loop 1. B = blind, V = verification gap, E = edge case. Verification-gap gaps arrive pre-verified.

| ID | Finding | Verdict | Route | Evidence |
|----|---------|---------|-------|----------|
| B1, E4 | Step screen dead-ends on a lapsed session | medium | patch | `complete-step-panel.tsx:108` prints the message only; `generate/page.tsx:149` already redirects. |
| B2 | No `signUpForceRedirectUrl` on `SignInCard` | maybe-false, low if true | rejected | Clerk's docs disagree on the prop; a person landing on `/` is sent on to `/path` anyway. README check added under B3. |
| B3 | README does not name the Clerk instance | medium | patch | Clerk's Vercel guide: production needs a domain you control; `*.vercel.app` uses development keys. The sign-up restriction half is low: the server allowlist holds. |
| B4, E23 | Privacy notice removed | low | rejected | The old links were placeholders and the only users are the operator and their partner. Raised with the human instead. |
| B5 | No deletion path | low | rejected | Mission rows have no trigger and can be deleted by SQL; a two-person test needs no flow. |
| B6 | Mission review has no edit action | low | rejected | The spec removed the fixture link deliberately; the screen behind it was never real. |
| B7 | Refusals and cancels spend a slot | low | rejected | Their model calls were paid for; five in a day is unlikely, and the limit is configurable. |
| B8, E5 | Cap copy says missions were built when none were | medium | patch | `page.tsx:350,425` and `client.ts:311` assert success unconditionally. |
| E6 | "Tomorrow" is wrong for a UTC reset | low | patch | `usage.ts:31` counts UTC days; copy-only fix. |
| B9, E17 | Location never reaches the classifier | high | patch | `02-resolve.ts:72` omits it, while the form exposes it as free text and stages 4 and 5 receive it. |
| E18 | Goal and location sit outside the data rule | low | rejected | Only invited people can reach it, and only their own plan is affected. |
| B10, E24 | A long echoed detail can reach logs in `received` | low | patch | `schemas.ts:188` truncates before exact-match redaction, so a long value never matches. |
| B11 | Grounding strips person-stated prices and dates | low | defer | `grounding.ts:26,30` flag these wherever they come from, and always did for goal text. |
| B12, E2 | Every preview build runs migrations | medium | patch | `vercel.json:5` runs `db:deploy` unconditionally; Production-only variables fail the build. Rollback notes rejected as low. |
| E3 | README says a missing URL gives 503 | low | patch | `migrate deploy` fails the build first. Direct doc correction. |
| B13 | Invite changes and a mode-table row undocumented | low | patch | `authModeFromEnv` returns `clerk` for keys, non-production, empty list. Direct doc correction. |
| B14 | No post-deploy test plan | false | rejected | A delivery note, not a defect in this diff; the run recommendation covers it. |
| B15, E7, V-other | Hours validator disagrees with its copy | low | patch | `details-form.ts:70` accepts above 0; the message says from 0.5. |
| E8 | `badInput` silently blanks hours or a date | low | rejected | Needs a partly typed date or a non-numeric entry on a numeric keypad; adds a branch. |
| B16 | Sign-in fallback shifts layout, no failed state | medium | patch | `account.tsx:35`; section 6 applies. Theming half rejected: `docs/DESIGN.md` does not exist. |
| B17, E13 | Middleware does not trim keys; session comment overclaims | low | patch | `middleware.ts:10` against `account.ts:55`; `layout.tsx` imports Clerk statically. |
| B18, V-other | Spec notes garbled | low | rejected | The fix edits this build's spec. |
| V1 | Interpret abort test passes on its own failed assertion | medium | patch | `pipeline.test.ts:644` still reads the signal from argument two. |
| V2 | Details block untested in stages 1, 4 and 5 | medium | patch | Filed evidence. |
| V3 | Stage 1 structured output unpinned | medium | patch | Filed evidence; this is the fix for a real incident. |
| V4 | No test runs the middleware | medium | patch | Filed evidence. |
| V5 | `/generate` guard untested in Clerk mode | medium | patch | Filed evidence. |
| V6 | Refusal handling on `/generate` has no executing test | medium | patch | Filed evidence; extract the decision, keep the wiring a manual check. |
| V7 | `globalThis` cache unverified | low | patch | Filed evidence. |
| V8 | Sign-out provider wiring tested against a stub | medium | patch | Filed evidence. |
| E1 | NUL or lone surrogate fails the insert after spend | low | rejected | Needs a hand-built request from an invited person. |
| E9 | Five-digit year gets the wrong message | low | rejected | The server rejects it; only the wording is off. |
| E10 | Limit above int4 breaks generation | low | rejected | Operator typo, visible at once. |
| E11 | Store typo downgrades to memory | low | rejected | Outside production only; production refuses memory. |
| E12 | Cache key misses a password change | low | rejected | Environment changes mean a new deployment and process. |
| E14 | Midnight between two parses | low | rejected | A window of milliseconds. |
| E15 | Impossible goal plus bad weights fails generically | low | rejected | Needs both at once; adds a guard. |
| E16 | Worrying detail plus a stage failure shows a build error | maybe-false, medium if true | defer | Three real wordings reached `support`; a model refusal at stage 1 or 2 is untested. |
| E19 | Model can infer a past deadline | low | rejected | The prompt forbids it, and stated dates override. |
| E20 | A read creates a Principal row | low | patch | Harmless behaviour; the `guest-missions.ts` header comment is wrong. Comment fix only. |
| E21 | Complete route parses the body before identity | low | rejected | Same-site check first and bounded by the photo limit; the order is documented. |
| E25 | Rewrite pass lacks details | low | rejected | It edits single flagged sentences and keeps their meaning. |
| E26 | Redis counts refused attempts | low | rejected | Dormant driver; only differs if the limit is raised mid-day. |

## Design Notes

**Story 7.3 tension:** its AC keeps the structured baseline and goal number out of model prompts. This spec's free-text starting point does enter prompts, because tailoring is the purpose, and the pipeline already sends the model's own extraction of level. Story 7.3's structured fields remain unbuilt and its rule intact.

**CAP-7 tension:** sign-in first departs from "value before signup" for this test only, which is why the guest path stays dormant instead of being deleted.

**Modes:** Clerk keys present means Clerk. Keys absent outside production means guest mode, so `next build` in CI and the existing route tests keep working. Keys absent in production means disabled.

## Verification

**Commands:**
- `pnpm verify` -- expected: format, lint, typecheck, all tests and build pass with no credentials.
- `node scripts/generation-incidents.mjs` -- expected: no new rejection cluster after real runs.

**Manual checks (if no CLI):**
- Three real generations with details, then read the steps. Against a real Postgres: generate, restart the server, read the mission and XP back.
- Keyboard pass and 375px on `/` and `/generate`. Clerk sign-in needs the person's own keys, so if they are absent, report it as unverified rather than passed.
</content>
