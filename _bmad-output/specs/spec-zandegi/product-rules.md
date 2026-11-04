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

Every Chapter and Step has a stable ID that survives edits. The 3-7 and 2-9 limits bind generated Missions. A person may then rewrite, reorder, add, or delete Steps, up to a storage limit. A person cannot add or remove Chapters in the MVP because boss targets depend on their number. An accepted recovery Chapter is the one exception, and it never raises an existing target. Editing a generated Step's text removes its sources and marks it as the person's own. Person-written Steps skip grounding: they are the person's own words, shown only to them, and never sent to a model.

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

Declared busy periods are left out of the completion rate, and person-written Steps are never resized.

## Tool registry

The intended tool kinds remain `TRACKER`, `TIMER`, `CHECKLIST`, `TEMPLATE`, `CALCULATOR`, `PLANNER`, `LIBRARY`, `DRILL`, `JOURNAL`, and `CAPTURE`.

- A tool implements a pure transition and returns state plus candidate facts.
- API use cases load and save tool state and decide whether a fact qualifies.
- Clients submit commands, never trusted facts or award totals.
- Tool use alone is not rewardable.
- Tools may produce `TIMER`, `ARTIFACT`, or `METRIC` evidence; simple completion maps to `SELF`.

## Boss fights

Each Chapter has one real-world test, visible from the Chapter's start. A person may attempt it once they finish or choose to skip the remaining Steps. Skipped Steps pay nothing.

| Goal | Boss | Payout |
| --- | --- | --- |
| `METRIC` with a registered metric kind | A number from the target formula | Fixed bands on a new personal best: any gain, then reaching the published target |
| All other goals, including unregistered metrics | A real act based on the Chapter's exit condition | A fixed amount once, with a small addition for an optional photo |

**Target formula.** `target = best + min(remaining / chaptersLeft, cap × best)`, mirrored for lower-is-better metrics and rounded to the metric kind's increment. After a miss, the next target never rises above the one missed. A rematch target sits halfway between the best and the missed target. A person may lower any target, but the top band still requires the published target. If the cap cannot reach the goal, the app says the plan is tight.

**Closing a Chapter.** An attempt and a debrief with at least one answer close the Chapter, whatever the result. A rematch is optional, does not reopen the Chapter, and pays only the difference up to a higher band, so boss XP per Chapter cannot exceed the top band.

**Debrief.** Prompts cover tips, what went well, what didn't, and what the person will improve. The last becomes the next Chapter's opening Step in the person's own words, and they can remove it.

**Real-act safety.** Trials depend only on the person's own actions, never on another person's response. Model-written trial text must pass grounding and safety checks.

## Progression and economy

`core` owns progression and its versioned policy. `economy` owns Shards, Crowns, commerce, entitlements, and economy tuning only.

| Evidence kind | MVP award input |
| --- | --- |
| `SELF` | Fixed neutral completion policy, with a per-Chapter Step cap. |
| `TIMER` | Bounded server-observed active time. |
| `ARTIFACT` | Server-authored reward band after evidence verification. |
| `METRIC` | Registered server-side metric policy. |
| `INTEGRATION` | No award in MVP. Requires a future provider-specific attestation policy. |

The exact award constants, caps, level curve, rank thresholds, and provisional-review thresholds require product approval before implementation. The original estimated-minute multipliers are retired.

Boss fights replace the Chapter bonus, and a fixed mission reward replaces the mission bonus. Awards already recorded under `neutral-v1` stay as they are. New awards use a new policy version.

XP is never purchasable or spendable. Any future Shards, Crowns, subscription, boost, or entitlement design must not affect XP, streak repair, rank, leaderboard position, or other earned progression. The old paid Crew XP boost and purchasable streak repair are retired.

Risk evaluation happens synchronously during completion. Provisional awards remain visibly pending and do not update spendable balance, rank, streak, leaderboard, or celebrations until promoted; rejection uses a typed reversal.

## Internal scheduler

Mission Steps can become internal Blocks. Scheduling considers availability, energy preference, recovery gaps, and deadline pressure. A missed Block is not punished and may be offered a new internal slot within 48 hours. External calendar reading and two-way synchronization are post-MVP.

## Owning the journey

**Log anything.** A one-line note, number, or photo is filed under the current Chapter, and the person can move it. Logs pay no XP and use no model. Photo logs require private evidence storage.

**Busy periods.** A person declares a period with an end date and can extend it without penalty. Boss prompts and boss Blocks move until afterwards. Touch actions pay no XP. When it ends, the app gently offers to resume.

**Titles and badges.** Titles come from published rules over ledger behaviour, pay no XP, and appear in limited profile showcase slots. The midpoint badge marks closing the middle Chapter and compares first and latest results. Saved photos join it once private evidence storage exists. Prompts to use a title as a self-description are optional.

**Past wins.** When a person misses a boss or returns after a gap, the app may show their own earlier results. It never compares them with other people.

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

