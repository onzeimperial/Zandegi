---
id: SPEC-zandegi
companions:
  - product-rules.md
  - pursuit-catalog.md
  - source-reconciliation.md
  - ../../planning-artifacts/architecture/architecture-Zandegi-2026-09-25/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/architecture/architecture-Zandegi-2026-09-25/LEGACY-EXTRACTION-AND-REPAIR-PLAN.md
sources: []
---

> **Canonical contract.** This SPEC and every file in `companions:` define what Zandegi's MVP must build, test, and validate. The architecture spine wins if an older source conflicts with this contract.

# Zandegi MVP

## Why

People can name meaningful goals but often lack a safe, realistic path from intention to repeated action. Zandegi turns a person's words into a tailored Mission, supplies the tools and schedule needed to act, and makes genuine progress visible without letting AI estimates, payments, or engagement tricks determine achievement.

## Capabilities

- **CAP-1 — Goal intake and resolution**
  - **intent:** A person can state a free-text goal and receive a matching Pursuit or a safe generic scaffold.
  - **success:** The system preserves the deletable goal text, records explicit match confidence, and creates a review candidate when no Pursuit meets the approved threshold.

- **CAP-2 — Safe Mission generation**
  - **intent:** A person can receive a specific, actionable, sourced Mission suited to their constraints.
  - **success:** Individually validated chapters appear progressively, exactly one accepted Mission is persisted, and raw, unsafe, stale, or rejected model output is never released.

- **CAP-3 — Pursuit catalog**
  - **intent:** An operator can author, validate, version, and expand the initial 140-Pursuit catalog.
  - **success:** Every seed Pursuit passes schema, uniqueness, domain-weight, safety, source, exit-condition, tool-fit, and coverage checks with no placeholder content.

- **CAP-4 — Trusted completion and progression**
  - **intent:** A person can complete eligible work and receive deterministic, historically reproducible progression.
  - **success:** One idempotent server command records the accepted evidence, event, award, immediate projections, and outbox message atomically; replay and compensation reproduce the same state.

- **CAP-5 — Tools and private evidence**
  - **intent:** A person can use built-in tools and private evidence to carry out and verify Mission steps.
  - **success:** Only a qualifying server-attested fact can influence an award; evidence ownership, type, size, lifecycle, quota, access, and deletion rules are enforced.

- **CAP-6 — Internal scheduling**
  - **intent:** A person can turn Mission steps into time blocks and reschedule missed work without punishment.
  - **success:** Zandegi creates and updates internal Blocks from availability, energy, recovery, and deadline constraints without relying on an external calendar.

- **CAP-7 — Value before signup**
  - **intent:** A guest can experience the core loop before creating an account and then retain that progress.
  - **success:** Guest identity is server-owned and a one-time, idempotent claim into Clerk-backed identity neither loses nor duplicates Missions, evidence, events, or projections.

- **CAP-8 — Web MVP journey**
  - **intent:** A person can complete the full Zandegi MVP journey on the web.
  - **success:** A production-like vertical slice covers goal intake, validated Mission reveal, scheduling, trusted completion, a boss fight, progression, account claim, export, and deletion.

- **CAP-9 — Safe operations**
  - **intent:** An authorized operator can manage catalog candidates, content review, safety failures, evidence states, dead letters, and projection rebuilds.
  - **success:** Every operation is least-privilege, auditable, replay-safe, environment-isolated, and covered by a recovery runbook.

- **CAP-10 — Export and erasure**
  - **intent:** A person can export and delete their personal information without corrupting ledger integrity.
  - **success:** A retryable deletion workflow revokes identity, suppresses work, deletes content and evidence, removes identity resolution, and returns a completion receipt while only approved non-resolvable integrity facts remain.

- **CAP-11 — Proof of growth**
  - **intent:** A person can test what they can now do at the end of each Chapter, reflect on the result, and build a record showing they are capable of change.
  - **success:** Each Chapter has one boss fight with its target visible from the Chapter's start. An attempt plus a debrief closes the Chapter whatever the result. XP comes only from the published core policy, is bounded, and never depends on model output.

- **CAP-12 — Plans that fit real life**
  - **intent:** A person can rewrite, reorder, add, or delete Steps, log unplanned progress, and declare busy periods.
  - **success:** Plan edits never change a recorded award or earn extra XP. Logs add to the Goal's story and pay no XP. A busy period moves boss fights until afterwards, with no penalty.

## Constraints

- The finalized architecture spine governs package ownership, contracts, transactions, persistence, deployment, identity, evidence, privacy, and operational behaviour.
- `core` owns progression formulas and tuning. AI-generated estimates, payments, subscriptions, entitlements, purchased currency, and engagement never increase XP, repair streaks, alter rank, or improve competitive position.
- The evidence kinds are `SELF`, `TIMER`, `ARTIFACT`, `METRIC`, and `INTEGRATION`. `INTEGRATION` awards nothing until a provider-specific post-MVP attestation policy is approved.
- Merely opening or using a tool earns nothing; only a qualifying server-attested fact can support an award.
- Personal text, generated Mission content, provider payloads, and evidence files remain deletable and never enter the immutable progression/economy ledger.
- Safety, age restrictions, authorization, grounding, evidence trust, and stream release are server-enforced. Self-harm-adjacent requests route to support rather than Mission generation.
- Outcome goals never display a generic completion percentage. Gold styling denotes earned value only.
- The MVP runs as the managed Sydney deployment defined by the architecture, using private Vercel Blob for evidence and separate local/preview/production resources.
- External integrations, including external calendar sync, are not required for any MVP capability.
- Numeric boss targets come only from the published `core` formula, using the person's own baseline and goal number. They apply only to registered metric kinds; body weight, calories, and money get a real-act boss instead. A person can always lower a target. AI may write real-act trial text, which must pass grounding.
- Boss results are self-reported in the MVP and labelled as such. Payouts use fixed bands that stop at the target, and metric payouts require a new personal best.
- Debriefs, logs, and person-written Steps are deletable personal text. They never enter the ledger or a model prompt.
- A miss is never framed as a loss. The app may call a plan tight; it never judges the person.

## Non-goals

- Native mobile applications or offline completion.
- Billing, subscriptions, trials, paywalls, purchasable currency, shops, seasons, or gifting.
- Crews, feeds, duels, leaderboards, referrals, schools, or other social/competitive systems.
- Health, fitness, GitHub, banking, screen-time, music, or external calendar integrations.
- Regulated-document storage, clinical care, diagnosis, treatment, personal financial advice, or legal advice.
- Durable/resumable generation and a permanent staging environment.
- Video or witness proof, challenge codes, automated plausibility checks, and shareable boss-fight cards.

## Success signal

A new visitor can state a real goal, watch only validated Mission chapters appear, complete one eligible action, receive the correct server-determined result, create an account without losing progress, and later export or delete their personal data. The same journey passes the Postgres-backed replay, idempotency, safety, authorization, evidence, and recovery checks defined by the architecture.

## Open Questions

- Before the persistence schema freezes, what guest-retention duration, renewal activity, warning timing, and evidence-cleanup rule should apply?
- Before progression implementation, what exact step rewards and per-Chapter cap, boss reward bands, target cap, fixed mission reward, level curve, and provisional-review thresholds should product approve?
- Before Slice 2 starts, which measure shows whether boss fights reduce mid-goal drop-off? The premise is a product hypothesis, not yet backed by user data.
