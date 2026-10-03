# Zandegi MVP Product Rules

This companion preserves load-bearing product behaviour from the original specification while applying the finalized architecture.

## Goal universe

Zandegi uses three layers:

1. Eight permanent domains: Mind, Edge, Coin, Body, Grit, Craft, Bond, and World.
2. A versioned catalog of approximately 140 reusable Pursuits.
3. Infinite user Goals resolved to one or more Pursuits or to a generic scaffold with a `PursuitCandidate` for review.

An approved confidence threshold controls fallback. The existing proposed threshold is `0.62`; it remains tuning data, not a hard-coded domain invariant.

### Goal display rules

| Goal type | Allowed progress display | Generic percentage allowed? |
| --- | --- | --- |
| `OUTCOME` | completed chapters, evidence count, next action | No |
| `METRIC` | current-to-target and trend | Yes |
| `HABIT` | streak, consistency, calendar heatmap | Consistency only |
| `PROJECT` | completed steps within defined scope | Yes |
| `EXPERIENCE` | readiness checklist and booked/not-booked state | Checklist only |

## Mission contract

A Goal preserves the person's words for the life of the account, subject to export and deletion. A versioned Mission contains 3-7 Chapters; each Chapter contains 2-9 Steps. Chapters have meaningful exit conditions. Steps may contain a planning estimate, one verification method, applicable tool instances, a guide, and dated sources for factual claims.

Planning estimates help size work and never determine XP. Generic scaffolds use the same safety, grounding, persistence, and progression rules as catalog-backed Missions.

### Generation path

1. Interpret the goal and constraints.
2. Resolve one or more Pursuits or the generic scaffold.
3. Build a freshness-approved knowledge snapshot.
4. Plan Chapters and exit conditions.
5. Detail Steps, guides, planning estimates, and tool attachments.
6. Ground factual claims; rewrite unsupported claims as general advice or remove them.
7. Apply deterministic safety and age policy plus fail-closed model-output checks.
8. Validate each releasable Chapter against the versioned stream contract.
9. Persist one fully accepted Mission and emit an operational outbox message.

Mission generation does not calculate or promise XP. `MissionGenerated` is not a progression-ledger event. The performance target remains p95 under 25 seconds for first-Mission completion, subject to a shorter application deadline than the hosting limit.

### Adaptive sizing

Completion and abandonment history may influence the size or sequencing of future Steps. The retained starting policy biases future Steps 15% larger when seven-day completion exceeds 0.85 and 20% smaller, with a recovery Chapter, when it falls below 0.45. It cannot change the award for already completed work. Population learning may propose bounded Pursuit-tuning candidates using the original EWMA starting value of 0.15, but an approved, versioned policy is required before those values affect generation.

## Tool registry

The intended tool kinds remain `TRACKER`, `TIMER`, `CHECKLIST`, `TEMPLATE`, `CALCULATOR`, `PLANNER`, `LIBRARY`, `DRILL`, `JOURNAL`, and `CAPTURE`.

- A tool implements a pure transition and returns state plus candidate facts.
- API use cases load and save tool state and decide whether a fact qualifies.
- Clients submit commands, never trusted facts or award totals.
- Tool use alone is not rewardable.
- Tools may produce `TIMER`, `ARTIFACT`, or `METRIC` evidence; simple completion maps to `SELF`.

## Progression and economy

`core` owns progression and its versioned policy. `economy` owns Shards, Crowns, commerce, entitlements, and economy tuning only.

| Evidence kind | MVP award input |
| --- | --- |
| `SELF` | Fixed neutral completion policy. |
| `TIMER` | Bounded server-observed active time. |
| `ARTIFACT` | Server-authored reward band after evidence verification. |
| `METRIC` | Registered server-side metric policy. |
| `INTEGRATION` | No award in MVP. Requires a future provider-specific attestation policy. |

The exact award constants, caps, level curve, rank thresholds, and provisional-review thresholds require product approval before implementation. The original estimated-minute multipliers are retired.

XP is never purchasable or spendable. Any future Shards, Crowns, subscription, boost, or entitlement design must not affect XP, streak repair, rank, leaderboard position, or other earned progression. The old paid Crew XP boost and purchasable streak repair are retired.

Risk evaluation happens synchronously during completion. Provisional awards remain visibly pending and do not update spendable balance, rank, streak, leaderboard, or celebrations until promoted; rejection uses a typed reversal.

## Internal scheduler

Mission Steps can become internal Blocks. Scheduling considers availability, energy preference, recovery gaps, and deadline pressure. A missed Block is not punished and may be offered a new internal slot within 48 hours. External calendar reading and two-way synchronization are post-MVP.

## Safety and age rules

- The product is 13+; jurisdiction-specific consent requirements are enforced before launch.
- Under-18 restrictions are server-side and cannot be weakened during guest claim.
- Clinical content never diagnoses, prescribes, sets unsafe floors, or replaces professional care.
- Eating-risk content avoids unsafe calorie or weight-loss targets and body-comparison competition.
- Self-harm-adjacent goals route to support and do not generate Missions.
- Financial content is educational and never personal financial advice.
- Legal content is general information and never personal legal advice.
- Raw health, financial, provider, goal, or evidence content never enters model prompts unless the approved feature contract explicitly permits a minimized representation.

## Presentation commitments

- Deep violet is the brand; gold appears only on earned value and never on purchase controls.
- The eight-pointed life star remains the signature Character/progress visual.
- Motion is concentrated in validated Mission reveal, accepted progression, and earned milestones, with reduced-motion equivalents.
- Voice uses second person, present tense, and plain verbs. Errors state what happened and what to do.
- Web supports keyboard use, WCAG AA, stable loading states, reduced motion, and 375px layouts.

Retained starting tokens are `--void: #0A0714`, `--surface: #150F26`, `--edge: #241A3D`, `--violet: #7C3AED`, `--violet-lo: #4C1D95`, `--violet-hi: #A855F7`, `--gold: #F5C451`, `--paper: #FFFFFF`, and `--ink: #120C1F`. The starting typography direction is Clash Display or General Sans for display, Inter at a 16px base and 1.6 line height for body, a 68ch reading width, and tabular lining numerals for progression and metrics. Functional state motion starts at 180ms ease-out.

Detailed UX must be captured in a dedicated BMad UX artifact before the product-surface phase. Web and native clients share contracts and tokens, not screens or controls.

