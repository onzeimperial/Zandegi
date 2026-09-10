# Zandegi — Claude Code build prompts

Ten sessions. Run them in order. Each block between the `---PROMPT---` markers is copied verbatim into
Claude Code. Do not start a session until the previous session's exit criteria are all true.

**Before session 1:** copy `CLAUDE.md` to your repo root and `SPEC.md` to `docs/SPEC.md`. Commit both.

---

## Session 1 — Prove the generation is good

**Why first:** everything else is worthless if the missions are generic. This is the only unknown risk
that can kill the product, and it is cheap to test.

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md in full before doing anything. Then read the existing
packages/core exports and the zandegi-spike harness.

Goal this session: prove Zandegi can generate genuinely good missions across the full
breadth of human goals, or find out exactly where it fails.

1. Extend the existing spike harness to run 60 goals: 8 per domain plus 4 adversarial.
   Use real goals a real person would type, not clean ones. Include misspellings,
   vagueness ("be less of a mess"), impossible scope ("become a billionaire by March"),
   hyper-local specificity ("get into Melbourne High"), and volatile fact dependence
   ("apply for a 2027 Commonwealth Supported Place").
2. Implement the full 9-stage pipeline from SPEC Part II §2.2 in packages/ai. Stages 1-6
   and 8 use the model; stage 7 calls packages/core and must not touch the model.
3. Score every output against a rubric I can inspect. Score these axes 1-5:
   specificity (could this only be for this goal?), actionability (can a step be done
   today without further research?), grounding (are facts sourced and dated?),
   sequencing (do chapters build?), tool fit (are attached tools actually the right
   ones?), and honesty (does it avoid fake precision?).
4. Output a scored HTML review page grouped by domain, with the failures at the top,
   the prompt that produced each output, and the rubric scores visible.
5. Do not build any UI, database work, or infrastructure this session.

Exit criteria: I can open the HTML page and read 60 missions. Mean specificity and
actionability are both ≥ 4.0. Zero ungrounded hard factual claims survive the validator.
Write docs/BUILD-LOG.md with the failure patterns you found and your proposed prompt fixes.
---PROMPT---
```

**Do not proceed to session 2 until you have personally read 20 of those missions and would use them.**
If they're mediocre, iterate on session 1. This is the whole product.

---

## Session 2 — Seed the goal universe

```
---PROMPT---
Read CLAUDE.md, docs/SPEC.md Part I, and docs/BUILD-LOG.md.

Goal: author the full Pursuit catalog — all 140 slugs listed in SPEC §1.2.

1. Define the Pursuit type in packages/core exactly as specified in SPEC §1.2, with
   Zod schemas and full type tests.
2. Author every one of the 140 Pursuits as seed data in packages/db/seed/pursuits/,
   one TypeScript file per domain. Each Pursuit needs: real domain weights summing to 1,
   the correct goalType, 3-7 default chapter templates with real exit conditions, a
   populated toolKit, verification methods, knowledgeSlots for anything time-sensitive,
   a seeded difficultyPrior, and at least 3 antiPatterns. Set safetyClass correctly —
   check SPEC Part X for which pursuits are CLINICAL.
3. A Pursuit with an empty toolKit or a placeholder chapter fails review. Write a
   validation script `pnpm validate:pursuits` that fails CI on stubs, missing exit
   conditions, or domain weights that don't sum to 1.
4. Implement the resolver: free text → Pursuit match with confidence. Below 0.62,
   fall through to the generic scaffold and create a PursuitCandidate.
5. Write a test suite of 200 goal strings mapped to expected Pursuits. Target ≥ 85%
   top-1 accuracy, ≥ 95% top-3.

Exit criteria: `pnpm validate:pursuits` passes on all 140. Resolver accuracy hits target.
Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 3 — The unbreakable ledger

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md Parts IV and IX.

Goal: the event ledger, projections, and economy must be provably correct. This is the
foundation everything stands on and it must never need rewriting.

1. Full Prisma schema per SPEC Part IX. Migrations named descriptively.
2. Implement every event type. Event is strictly append-only — enforce with a Postgres
   trigger rejecting UPDATE and DELETE on that table, not just application code.
3. Implement projections: Character, DomainStat, Streak, Wallet. Each is a pure fold
   over events in packages/core.
4. Build `pnpm rebuild:projections --user <id>` and `--all`. Write a property test:
   for a random event sequence, incremental projection and full replay produce byte-identical
   state. This test is non-negotiable.
5. Implement packages/economy exactly per SPEC §4.1-4.4: XP formula with every multiplier,
   daily soft cap and per-pursuit cap, minimum-interval enforcement, level curve, rank
   thresholds, rarity percentile job, both currencies. Every tunable constant lives in
   packages/economy/tuning.ts with a comment explaining its intent.
6. Implement the trust score and the provisional-XP path.
7. Tests: at least 60 covering cap boundaries, streak edges (timezone rollover at 04:00
   local, DST, travel across timezones), the balance multiplier picking the correct weakest
   domain, rarity at tier boundaries, and compensating-event corrections.

Exit criteria: replay-equivalence property test passes over 1,000 random sequences. The
append-only trigger is verified by a test that tries to UPDATE and expects a failure.
Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 4 — The loop

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md Parts II, III, VII.

Goal: a person can state a goal, get a mission, schedule it, do a step, and earn XP.
End to end. Ugly is fine this session — working is not optional.

1. tRPC routers in packages/api: goals, missions, steps, tools, blocks, character,
   events. Auth via Clerk on every procedure. One happy-path and one auth-failure test each.
2. Wire the session-1 pipeline behind `missions.generate`, streaming so the client
   receives chapters as they land.
3. Implement the Tool Registry runtimes in packages/tools for the first six kinds:
   TRACKER, TIMER, CHECKLIST, TEMPLATE, CALCULATOR, CAPTURE. Each emits ledger events.
4. Implement the scheduler per SPEC Part VII: steps to blocks, availability windows,
   energy profile, recovery gaps for Body pursuits, deadline pressure. Missed blocks
   auto-offer a new slot within 48 hours — never a penalty.
5. Google Calendar two-way sync plus ICS export for Apple and Outlook.
6. Minimal unstyled Next.js screens to exercise all of it. Do not spend time on design
   this session; that is session 5.

Exit criteria: from a clean database I can sign up, type "run a half marathon in April",
get a real mission, see blocks land in Google Calendar, complete a timed session, and
watch my Body XP and level change. Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 5 — Make it beautiful

```
---PROMPT---
Read CLAUDE.md, docs/SPEC.md Part VIII, and the frontend-design guidance.

Goal: Zandegi should look like a game people want to be seen using, not a productivity app.

1. Write docs/DESIGN.md first: the full token system (colour, type scale, spacing, radii,
   elevation, motion curves), component inventory, and the voice rules. Show it to me
   before building.
2. Build packages/ui on the tokens. Restyle shadcn primitives; do not ship them stock.
3. Build the eight-pointed life star as the signature component — animated, responsive,
   shareable as an image, and usable as the loading state. This is the one bold thing;
   keep everything else disciplined around it.
4. Screens: Today (mobile home), Character, Mission detail with the guide sections,
   Mission generation reveal, Calendar, Crew, Shop, Season track, Profile.
5. The three orchestrated motion moments from SPEC Part VIII and nothing else.
   prefers-reduced-motion gets still equivalents.
6. Marketing site at /: hero, live generation demo (type a goal, watch it build — this
   is the conversion moment), the eight domains, pricing, free trial page, social proof
   slots. Purple and white. White Z on purple as the mark.
7. Every screen meets the definition of done in CLAUDE.md §6.

Exit criteria: screenshots of all screens at 375px and 1440px, light and dark. Lighthouse
accessibility ≥ 95 on the marketing site. Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 6 — Take money

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md Part V in full.

Goal: Zandegi can charge money, and the economy is instrumented well enough to tune.

1. Stripe on web: Plus and Prime, monthly and annual, AUD. Customer portal. Webhooks
   idempotent and replay-safe. Subscription state is a projection like everything else.
2. Entitlements service in packages/economy — a single `can(user, capability)` function.
   Every gate in the app calls it. No scattered tier checks.
3. Implement all five paywall moments from SPEC §5.4 and nothing else. Hard-code the
   rule that no purchase prompt renders within 60 seconds of a streak loss, mission
   abandonment, or error state — write a test proving it.
4. Trial variants behind a feature flag: 7-day card-required annual, 3-day card-less
   monthly. Wire both for A/B.
5. Shard packs, Crowns, the daily shop with real 24h Redis-backed rotation, and direct
   cosmetic purchase. Fixed-value only — no randomised paid rewards anywhere.
6. Season infrastructure: Season, SeasonProgress, free and premium tracks, tier
   advancement on seasonal XP, claim flow. Seed Season 1 "First Light" with all 150 tiers.
7. Crew Boost subscription and gifting.
8. Analytics per docs/ANALYTICS.md — write that file, covering every metric in SPEC §5.5.
   Build an internal /admin/economy dashboard showing faucets, sinks, and the
   Shard-earned-to-Shard-spent ratio.

Exit criteria: I can buy Plus in test mode, my entitlements change, I can buy a skin, and
the economy dashboard shows the transaction. Webhook replay is proven safe by a test.
Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 7 — The social layer

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md Part VI.

Goal: crews, feed, duels, leaderboards. Crews are the retention mechanic — treat them as
core, not a bonus.

1. Crews up to 12, invite links, roles, crew level from member seasonal XP, crew banner.
2. Weekly crew quests: collective XP target, Shard pot split on success. Generated
   Monday 04:00 local to the crew's modal timezone, sized to the crew's trailing average
   so it is achievable but not trivial.
3. Activity feed with reactions and preset nudges. No free-text comments in v1.
4. Duels: 1v1, 7-day XP race, mutual opt-in, Shard pot, permanent duel record.
5. Leaderboards: crew, friends, global-by-rank-tier, per-domain. Weekly competitive board
   and all-time prestige board. Provisional-XP users excluded. Redis-cached.
6. Privacy per SPEC Part VI and Part X. Under-18 accounts: crew-only, no global board,
   no shop. Verify this with tests, not just UI conditionals.
7. Push and email notifications with real preference granularity and a hard daily ceiling.
   Notifications about friends outperform notifications about yourself — prioritise those.

Exit criteria: two test accounts can crew up, run a quest, duel, and appear on a board.
Under-18 restrictions verified by test. Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 8 — Verification and integrations

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md Part III §3.2 and Part IV anti-farming.

Goal: XP means something because effort is actually verified.

1. Integration framework in packages/integrations: OAuth, token refresh, scoped
   permissions, revocation, sync jobs via Inngest, graceful degradation when a provider
   is down.
2. Ship: Apple Health, Google Fit, Strava, GitHub, Google Calendar, Screen Time /
   Digital Wellbeing. Basiq behind a flag.
3. ARTIFACT verification: photo and file capture with EXIF timestamp checks, stored in
   R2 or S3, with a review queue for flagged submissions.
4. Wire the verification multipliers into the XP path and prove each tier pays correctly.
5. Anti-farming enforcement server-side, all four rules from SPEC §4.1, each with a test
   that tries to cheat and fails.
6. Trust score computation and the provisional-XP path end to end.
7. Health and financial data encrypted at rest with a separate key, excluded from LLM
   prompts in raw form, independently deletable.

Exit criteria: a Strava run appears as a completed step with 1.4× XP. A scripted farming
attempt earns nothing. Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 9 — Mobile

```
---PROMPT---
Read CLAUDE.md and docs/SPEC.md.

Goal: an Expo app sharing @zandegi/core and the tRPC client. Mobile is the daily loop;
web is discovery, planning, and depth.

1. Expo app with Clerk auth, tRPC client, and the shared token system from packages/ui
   ported to React Native.
2. Screens: Today, Mission detail, quick-complete, Character, Crew feed, Shop, Season.
3. Native: push notifications, camera for ARTIFACT capture, HealthKit and Health Connect,
   widgets showing streak and today's blocks, Live Activity for an active TIMER session.
4. RevenueCat wrapping StoreKit and Play Billing. Entitlements reconcile with the web
   subscription state — one source of truth, not two.
5. Offline: queue completion events locally, sync on reconnect, resolve conflicts by
   `occurredAt`.
6. Under-18 accounts must not see the shop on mobile either — verify.

Exit criteria: TestFlight and internal Play track builds installed and running the full
loop offline and online. Update BUILD-LOG.md.
---PROMPT---
```

---

## Session 10 — Launch readiness

```
---PROMPT---
Read CLAUDE.md, docs/SPEC.md Part X, and docs/BUILD-LOG.md in full.

Goal: ship-ready.

1. Safety audit: walk every CLINICAL pursuit and every guardrail in SPEC Part X. Write
   an adversarial test suite that tries to make Zandegi give medical, financial, or
   legal advice, set a dangerous calorie or weight-loss target, or generate a
   self-harm-adjacent mission. Every attempt must fail safely.
2. Load: 10,000 concurrent users, generation queue under burst, leaderboard reads,
   season tier claims at reset. Fix what breaks.
3. Cost model: per-user monthly inference cost at each tier. If Free-tier inference cost
   exceeds A$0.40/user/month, propose caching, model routing, or limit changes — do not
   silently ship an unprofitable free tier.
4. Legal surfaces: terms, privacy policy, AU Consumer Law refunds, subscription
   disclosures for both stores, data export and deletion.
5. Onboarding polish: measure time-to-first-XP and get p50 under 180 seconds.
6. Seed the SACify Classroom bundle: teacher dashboard, class crews, safe mode.
7. Write docs/RUNBOOK.md: deploys, rollbacks, projection rebuild, season rollover,
   incident response.

Exit criteria: adversarial safety suite fully green, load targets met, cost model
documented, RUNBOOK complete.
---PROMPT---
```

---

## Standing rules for every session

Paste this at the end of any session prompt if Claude Code starts drifting:

```
Reminder: read CLAUDE.md. Do not build outside this session's scope. Do not implement
exam-specific primitives in core. Do not let money buy progression. Do not display a
percentage for an OUTCOME goal. Do not let the model assign any number that affects XP,
rarity, or rank. Post your plan and file list before writing code.
```
