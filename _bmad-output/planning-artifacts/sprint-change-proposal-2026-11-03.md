---
type: sprint-change-proposal
project: Zandegi
date: 2026-11-03
trigger: _bmad-output/brainstorming/brainstorm-goal-progression-2026-11-01/brainstorm-intent.md
scope: moderate
status: approved
approved: 2026-11-03
author: Aadi (product owner), drafted through bmad-correct-course
---

# Sprint Change Proposal: Goal Progression Rethink

## 1. Issue summary

**Problem.** Progress in Zandegi is a pile of ticks. A Step pays 40 XP for a check or 50 for a photo, plus Chapter and Mission bonuses. The product owner judges that this does not feel rewarding and that the path has no moments proving anything has changed. The underlying need is self-efficacy: the belief "I can grow myself as a person."

**Type of change.** A strategic product change, not a defect. No sprint story triggered it. The nearest work is `d81c419` (9 October), which shipped the current XP loop without a story.

**Discovery.** A brainstorm on 1 November 2026, recorded in `brainstorm-intent.md`.

**Evidence.**

| Claim | Evidence | Strength |
| --- | --- | --- |
| Bonuses dwarf Step rewards | `packages/core/src/scoring/award.ts:55`, `xp.ts:127,137`. In a 5×5 Mission, bonuses are 4,500 of 5,500 XP (82%). | Verified in code |
| Rewards can be farmed once plans are editable | A self-written tick in the largest Chapter can be worth up to 540 XP (40 Step + 100 Chapter + 400 Mission). | Verified in code |
| People quit in the middle of long goals | Stated by the coach during the brainstorm. No user data or analytics exists. | **Hypothesis** |
| Targets set too hard make people stop | Stated by the owner during the brainstorm. | **Hypothesis** |

The hypotheses are acceptable grounds for a product decision. Story 7.7 exists so they get tested.

## 2. Impact analysis

### Decisions made

| Question | Decision |
| --- | --- |
| Does a Chapter close on a miss? | Yes. Any real attempt plus a debrief closes it. Rematches are optional. |
| How is XP restructured? | Boss fights replace the Chapter bonus. A fixed reward replaces the Mission bonus. Steps pay a small flat amount with a per-Chapter cap. |
| How are fake results limited? | Fixed bands that stop at the target. Metric bands pay only on a new personal best. Results are labelled self-reported. |
| How is the work phased? | Two slices, both in the MVP. |
| How are metric targets set? | Remaining distance split across Chapters left, with a per-fight cap. |
| How are real-act bosses paid? | A fixed amount once, on self-report, with a small addition for an optional photo. |
| How does busy-period mode end? | The person sets an end date and can extend it without penalty. |
| Where is Slice 1 built? | On the current ledger port. Story 2.2 moves it to Postgres before production. |

MVP remains solo. Crews, video proof, and integrations stay post-MVP, as recorded in `brainstorm-intent.md`. The full-crew XP bonus still conflicts with "engagement never increases XP" and needs a rule change if crews are ever scoped.

### Findings the brainstorm did not cover

| # | Finding | Evidence | Resolution |
| --- | --- | --- | --- |
| 1 | Paying on a typed number can be faked | Plausibility checks and video were deferred; `CAP-5` requires a server-attested fact | Capped bands and a `self-declared` marker (AD-5) |
| 2 | Editing a plan breaks the ledger | Steps are keyed by position: `ledger.ts:138`, `complete-step.ts:146` | Stable IDs (Story 7.2, AD-3) |
| 3 | Plan edits can farm up to 540 XP per tick | `award.ts`, `xp.ts` | Boss XP replaces bonuses; per-Chapter Step cap |
| 4 | Formula targets can breach safety rules | `SafetyClass` has no eating-risk value (`client.ts:115`) | Registered metric kinds only; a person can lower any target |
| 5 | The formula has no inputs | The request has four fields, none a baseline or target (`client.ts:26`) | Story 7.3. `estimatedMinutes` cannot be used (law 5) |
| 6 | Photos are discarded | `evidence.ts:9` keeps only a fingerprint | Photo logs and photo badges depend on Story 2.4 |
| 7 | `HABIT`, `PROJECT`, `EXPERIENCE` had no boss design | Brainstorm covers `METRIC` and `OUTCOME` only | Real-act boss based on the existing `exitCondition` |
| 8 | Streaks do not exist | Only a multiplier function, `xp.ts:58`; no story builds them | Busy mode moves boss fights; there is nothing else to protect yet |
| 9 | Debriefs and logs are personal text | AD-12, NFR5, no raw content in model prompts | Relational and deletable. No AI filing or rewriting |
| 10 | The core premise has no user data | `docs/ANALYTICS.md` does not exist | Story 7.7 and a new open question |

### Epic impact

| Epic | Impact |
| --- | --- |
| Epic 1 | Contract and validation additions (Stories 1.4, 1.5, 1.18). Status corrections. |
| Epic 2 | Reward numbers move to Story 7.1. Boss events join the contracts. Story 2.2 replaces the demo ledger. |
| Epic 3 | Boss fights can be scheduled. Recovery and adaptive sizing rules change. |
| Epic 4 | Claim, export, and deletion cover the new personal records. |
| Epic 5 | None. |
| Epic 6 | Surfaces expand. The UX contract now comes before Story 7.3. |
| Epic 7 (new) | Slice 1: boss fights, gain XP, rematches, debriefs, and their prerequisites. |
| Epic 8 (new) | Slice 2: plan editing, logs, busy periods, titles and badges, past wins. |

No epic becomes obsolete.

### Artifact conflicts

- **`SPEC.md`:** new capabilities, constraints, non-goal, and open questions.
- **`product-rules.md`:** new Boss fights and Owning the journey sections; progression changes.
- **`ARCHITECTURE-SPINE.md`:** AD-1, AD-3, AD-5, AD-12, the capability map, and Deferred.
- **`epics.md`:** 12 FRs, 2 epics, 12 stories, and changes to 14 existing stories.
- **`sprint-status.yaml`:** new epics, status corrections, and action items.
- **`deferred-work.md`:** the client XP product decision is settled.
- **UX contract:** `DESIGN.md` and `EXPERIENCE.md` do not exist yet and must cover boss fights.
- **`docs/ANALYTICS.md`:** does not exist; `CLAUDE.md` requires it; Story 7.7 creates it.

### Technical impact

- `packages/core`: new `progression-v2` policy and target formula, with tests.
- `packages/api`: stable IDs, a pure upcaster, boss attempt and rematch use cases, and later plan-edit, log, and busy-period use cases.
- `packages/db`: stores for attempts, debriefs, logs, busy periods, and editable Steps behind ports.
- `apps/web`: intake fields, boss and debrief screens, and removal of the builder's `+N XP`.
- No rollback. Awards recorded under `neutral-v1` stay as they are.

## 3. Recommended approach

**Direct Adjustment, delivered in two slices.**

| Option | Verdict | Reason |
| --- | --- | --- |
| Direct Adjustment | **Selected.** Effort: medium to high. Risk: medium. | The existing plan absorbs this with two new epics and targeted story changes. |
| Rollback | Not viable | Nothing needs reverting. The append-only ledger keeps old awards valid under `neutral-v1`. |
| MVP Review | Not needed | No cut is forced. Scope grows by two capabilities, and phasing manages the risk. |

**Rationale.** Slice 1 tests the central idea, whether a real-world test makes progress feel earned, before the plan-ownership features are built. It also meets the one-line test in `CLAUDE.md`: a real person does a real thing, then feels it.

**Timeline.** No calendar estimate is given because the reward numbers, UX contract, and metric kinds are unresolved inputs. Epic 7 now comes before the remaining Epic 2 work.

**Risks.**

| Risk | Mitigation |
| --- | --- |
| Self-declared results weaken trust in XP | Capped bands now, stronger proof post-MVP. Must be revisited before any leaderboard. |
| Understated baselines make gains easier | Bands cap the payout per Chapter. Accepted for the solo MVP. |
| The demo ledger is not atomic (AD-4) | Recorded under Deferred; Story 2.2 must replace it before production. |
| Scope grows on a large backlog | Slice 1 can ship and be measured before Slice 2 starts. |
| The core premise proves wrong | Story 7.7 measures it before Epic 8 starts. |

## 4. Detailed change proposals

All six proposals were approved individually on 3 November 2026.

### 4.1 `_bmad-output/specs/spec-zandegi/SPEC.md`

**Capabilities: add after CAP-10.**

```markdown
- **CAP-11 — Proof of growth**
  - **intent:** A person can test what they can now do at the end of each Chapter, reflect on the result, and build a record showing they are capable of change.
  - **success:** Each Chapter has one boss fight with its target visible from the Chapter's start. An attempt plus a debrief closes the Chapter whatever the result. XP comes only from the published core policy, is bounded, and never depends on model output.

- **CAP-12 — Plans that fit real life**
  - **intent:** A person can rewrite, reorder, add, or delete Steps, log unplanned progress, and declare busy periods.
  - **success:** Plan edits never change a recorded award or earn extra XP. Logs add to the Goal's story and pay no XP. A busy period moves boss fights until afterwards, with no penalty.
```

**CAP-8 success: edit.**

- OLD: `...covers goal intake, validated Mission reveal, scheduling, trusted completion, progression, account claim, export, and deletion.`
- NEW: `...covers goal intake, validated Mission reveal, scheduling, trusted completion, a boss fight, progression, account claim, export, and deletion.`

**Constraints: add.**

```markdown
- Numeric boss targets come only from the published `core` formula, using the person's own baseline and goal number. They apply only to registered metric kinds; body weight, calories, and money get a real-act boss instead. A person can always lower a target. AI may write real-act trial text, which must pass grounding.
- Boss results are self-reported in the MVP and labelled as such. Payouts use fixed bands that stop at the target, and metric payouts require a new personal best.
- Debriefs, logs, and person-written Steps are deletable personal text. They never enter the ledger or a model prompt.
- A miss is never framed as a loss. The app may call a plan tight; it never judges the person.
```

**Non-goals: add.**

```markdown
- Video or witness proof, challenge codes, automated plausibility checks, and shareable boss-fight cards.
```

**Open Questions: replace the second and add a third.**

- OLD: `Before progression implementation, what exact neutral rewards, authored reward bands, caps, level curve, and provisional-review thresholds should product approve?`
- NEW:

```markdown
- Before progression implementation, what exact step rewards and per-Chapter cap, boss reward bands, target cap, fixed mission reward, level curve, and provisional-review thresholds should product approve?
- Before Slice 2 starts, which measure shows whether boss fights reduce mid-goal drop-off? The premise is a product hypothesis, not yet backed by user data.
```

**Justification.** Records the decisions as requirements so the plan cannot drift from them.

### 4.2 `_bmad-output/specs/spec-zandegi/product-rules.md`

**Mission contract: add after the first paragraph.**

```markdown
Every Chapter and Step has a stable ID that survives edits. The 3-7 and 2-9 limits bind generated Missions. A person may then rewrite, reorder, add, or delete Steps, up to a storage limit. A person cannot add or remove Chapters in the MVP because boss targets depend on their number. An accepted recovery Chapter is the one exception, and it never raises an existing target. Editing a generated Step's text removes its sources and marks it as the person's own. Person-written Steps skip grounding: they are the person's own words, shown only to them, and never sent to a model.
```

**Adaptive sizing: add.**

```markdown
Declared busy periods are left out of the completion rate, and person-written Steps are never resized.
```

**New section before "Progression and economy".**

```markdown
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
```

Worked example, with the cap at a placeholder of 10%: bench 60kg towards 100kg over 5 Chapters. The split gives +8kg and the cap gives +6kg, so the first target is 66kg. A result of 62.5kg misses. A rematch target sits halfway, at about 64.25kg before rounding, and the next Chapter's target stays at 66kg rather than rising.

**Progression and economy: edit and add.**

- OLD: `` | `SELF` | Fixed neutral completion policy. | ``
- NEW: `` | `SELF` | Fixed neutral completion policy, with a per-Chapter Step cap. | ``

```markdown
Boss fights replace the Chapter bonus, and a fixed mission reward replaces the mission bonus. Awards already recorded under `neutral-v1` stay as they are. New awards use a new policy version.
```

**New section after "Internal scheduler".**

```markdown
## Owning the journey

**Log anything.** A one-line note, number, or photo is filed under the current Chapter, and the person can move it. Logs pay no XP and use no model. Photo logs require private evidence storage.

**Busy periods.** A person declares a period with an end date and can extend it without penalty. Boss prompts and boss Blocks move until afterwards. Touch actions pay no XP. When it ends, the app gently offers to resume.

**Titles and badges.** Titles come from published rules over ledger behaviour, pay no XP, and appear in limited profile showcase slots. The midpoint badge marks closing the middle Chapter and compares first and latest results. Saved photos join it once private evidence storage exists. Prompts to use a title as a self-description are optional.

**Past wins.** When a person misses a boss or returns after a gap, the app may show their own earlier results. It never compares them with other people.
```

**Justification.** Turns the decisions into exact, testable rules and closes the loopholes found during analysis.

**Authority note.** `CLAUDE.md` law 6 says any Mission step that asserts a fact must carry a source. The owner approved reading this law as applying to content Zandegi generates, so person-written Steps skip the grounding check. `CLAUDE.md` itself is not changed.

### 4.3 `ARCHITECTURE-SPINE.md`

**Frontmatter:** set `updated` to `2026-11-03`.

**AD-1 Rule: add.**

```markdown
Boss attempts and their awards, and earned titles and badges, are ledger facts. Debriefs, logs, person-written Steps, plan edits, busy periods, and raw boss results are relational records.
```

**AD-3 Rule: add.**

```markdown
Steps and Chapters have stable IDs that are never reused. Payment claims key on those IDs, so deleting and re-adding a Step cannot pay twice. New events carry IDs. A pure upcaster reads older events by deriving the ID from their recorded position, so `neutral-v1` history stays replayable and generated Steps keep position-derived IDs. Person-written Steps get new opaque IDs. Boss award events store an opaque attempt ID, award band, amount, and calculator and policy versions. Folds use the stored amount and never recalculate it. The raw result stays in a deletable record outside the ledger.
```

**AD-5 Rule: add.**

```markdown
In the MVP, a boss result is a `METRIC` or `SELF` fact marked `self-declared`. The server attests that the declaration was made, not that it is true, so the policy may pay only fixed, capped bands and pays metric bands only on a new personal best. The target formula lives in `core` and takes only the person's baseline, goal number, best result, and Chapters left, plus the metric kind's registered rules. Model estimates are rejected as inputs. Targets may be shown before an attempt; the XP they would pay may not.
```

**AD-12 Rule: add.**

```markdown
Debriefs, logs, person-written Steps, and raw boss results are personal content, covered by both export and deletion.
```

**Capability → Architecture Map: add.**

```markdown
| Boss fights, targets, titles, and badges | `core`, `api`, `db`, `web` | AD-1, AD-3, AD-5, AD-12 |
| Plan edits, debriefs, logs, and busy periods | `api`, `db`, `web` | AD-1, AD-2, AD-12 |
```

**Deferred: add.**

```markdown
- Moving boss fights off the demo ledger. Slice 1 runs on the Redis-backed `ProgressLedgerPort`, whose separate claim and append steps do not meet AD-4's atomic rule. Story 2.2 must replace it before production launch, behind the same port. Decide then whether to migrate or retire demo data.
```

**Accepted trade-offs.**

- Self-declared results narrow what `CAP-5` attestation means. This holds only while payouts stay capped, and must be revisited before any leaderboard.
- AD-3's "accepted inputs" for a boss award means its band and amount. After a person deletes their data, the amount paid remains visible but the number behind it does not.
- A generated Step's ID reflects its original position, not its current order.

### 4.4 `_bmad-output/planning-artifacts/epics.md`: new content

**Functional Requirements: add.**

```markdown
FR35: A person can give a baseline and goal number at intake for a registered metric kind, and confirm the goal type.

FR36: The system can publish each Chapter's boss fight from the start, using the core target formula or a real-act trial.

FR37: A person can attempt a boss fight and close the Chapter with a debrief, whatever the result.

FR38: The system can pay boss XP in fixed, capped bands marked self-declared, on a new personal best for metric goals.

FR39: A person can take an optional rematch with a recalibrated target, paid only as the difference up to a higher band.

FR40: The system can turn a debrief's "what I'll improve" into the next Chapter's opening Step in the person's own words.

FR41: A person can rewrite, reorder, add, or delete Steps without changing recorded awards or earning extra XP.

FR42: A person can log a note, number, or photo under a Chapter for no XP.

FR43: A person can declare and extend a busy period that moves boss fights until afterwards, with no penalty.

FR44: A person can earn titles and badges from published behaviour rules and show them in limited profile slots.

FR45: The system can show a person their own earlier results after a miss or a return from a gap.

FR46: The system can measure mid-goal drop-off without personal content.
```

**FR Coverage Map: add.** FR35–FR40 and FR46 to Epic 7; FR41–FR45 to Epic 8.

**Epic List: add.**

```markdown
### Epic 7: Prove You Can Change

A person can test what they can now do at the end of each Chapter, reflect on it, and earn progress for real gains.

**FRs covered:** FR35-FR40, FR46

**Implementation notes:** Slice 1. Runs before the remaining Epic 2 stories on the current ledger port. The UX contract must cover boss fights before Story 7.3. Order: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, with 7.7 alongside.

### Epic 8: Make the Plan Yours

A person can shape the plan around real life, record unplanned progress, and see evidence of who they are becoming.

**FRs covered:** FR41-FR45

**Implementation notes:** Slice 2. Starts after the drop-off measure from Story 7.7 is agreed. Photo logs and photo badges depend on Story 2.4.
```

**Stories: add.**

```markdown
## Epic 7: Prove You Can Change

A person can test what they can now do at the end of each Chapter, reflect on it, and earn progress for real gains.

### Story 7.1: Publish the progression-v2 Reward Policy

**Requirements:** FR38

As a Zandegi participant,
I want rewards to favour real-world tests over ticks,
So that XP reflects what I can now do.

**Acceptance Criteria:**

**Given** the product owner has approved the step reward and per-Chapter cap, boss bands, target cap, fixed mission reward, and level curve
**When** the policy is published in `core`
**Then** it carries a new calculator version with every tunable value and rationale in versioned configuration
**And** no value is hard-coded outside that configuration.

**Given** events recorded under `neutral-v1`
**When** progress is folded
**Then** their stored amounts are used unchanged
**And** golden fixtures prove the total is identical before and after this story.

**Given** a person adds Steps to a Chapter
**When** Step rewards are calculated
**Then** the per-Chapter cap limits the total
**And** no Chapter or mission bonus scales with step count.

**Given** the calculator receives model estimates or client totals
**When** an award is calculated
**Then** they are rejected as inputs.

### Story 7.2: Give Chapters and Steps Stable IDs

**Requirements:** FR41

As a person following a Mission,
I want my progress tied to the Step itself rather than its position,
So that changing my plan can never scramble what I have done.

**Acceptance Criteria:**

**Given** a generated Mission
**When** it is accepted
**Then** every Chapter and Step has a stable ID derived from its generated position
**And** an ID is never reused.

**Given** events recorded with Chapter and Step indices
**When** they are read
**Then** a pure upcaster derives their IDs without any database, clock, or calculator call
**And** folded XP and completion are identical to before.

**Given** a new completion is recorded
**When** its payment claim is made
**Then** the claim keys on the stable ID
**And** a retried request pays once.

**Given** existing Missions stored before this story
**When** they are read
**Then** they resolve to position-derived IDs
**And** their path and next Step are unchanged.

### Story 7.3: Capture Baseline and Goal Number at Intake

**Requirements:** FR35

As a person stating a measurable goal,
I want to say where I am starting from and where I am heading,
So that my boss fights are built from my real position.

**Acceptance Criteria:**

**Given** the approved list of registered metric kinds
**When** a person states a goal
**Then** they can confirm the goal type and, for a registered kind, give a baseline, goal number, and unit
**And** these fields are optional and never hint that the goal is out of reach.

**Given** a metric that is body weight, calories, money, or otherwise unregistered
**When** intake completes
**Then** no numeric target is offered
**And** the Mission uses a real-act boss.

**Given** a baseline and goal number
**When** they are stored
**Then** they sit in deletable relational records owned by the principal
**And** they never enter the ledger or a model prompt.

**Given** malformed, out-of-range, or client-forged values
**When** validation runs
**Then** the server returns a stable safe error.

### Story 7.4: Show Each Chapter's Boss Fight

**Requirements:** FR36

As a person at the start of a Chapter,
I want to see the real test ahead of me,
So that it pulls me forward from the first day.

**Acceptance Criteria:**

**Given** a Chapter of a metric goal with a registered kind
**When** the target is computed
**Then** the pure `core` formula uses only the baseline, goal number, best result, Chapters left, and the kind's registered rules
**And** model estimates are rejected.

**Given** any other goal
**When** the boss is displayed
**Then** it presents a real act based on the Chapter's exit condition, depending only on the person's own actions
**And** an `OUTCOME` goal shows no percentage.

**Given** the cap cannot reach the goal within the Chapters left
**When** the target is displayed
**Then** the app says the plan is tight
**And** the copy never judges the person.

**Given** a person lowers a target
**When** it is saved
**Then** their target is shown as theirs
**And** the published target remains the reference for the top band.

**Given** any boss display or the builder
**When** it renders before completion
**Then** no XP amount is promised
**And** the builder's `+N XP` is removed.

### Story 7.5: Attempt, Debrief, and Close a Chapter

**Requirements:** FR37, FR38, FR40

As a person who has done the real thing,
I want to record what happened and reflect on it,
So that any honest attempt moves me forward.

**Acceptance Criteria:**

**Given** a person has finished or chosen to skip the remaining Steps in a Chapter
**When** they submit a boss attempt with a debrief of at least one answer
**Then** the Chapter closes whatever the result
**And** the raw result and debrief are stored as deletable records outside the ledger.

**Given** a metric attempt is a new personal best
**When** the award is calculated
**Then** the core policy pays the matching fixed band, marked self-declared
**And** the top band is paid only at the published target, even if the person lowered their own.

**Given** a real-act attempt is reported as done
**When** the award is calculated
**Then** a fixed amount pays once, with a small addition for an optional photo
**And** no percentage is displayed.

**Given** an attempt shows no gain
**When** the result is displayed
**Then** it pays no boss XP and offers a rematch
**And** the copy never frames it as a loss.

**Given** a debrief answers "what I'll improve"
**When** the next Chapter opens
**Then** that answer is its opening Step in the person's own words, removable by the person
**And** no model call is made.

**Given** the same attempt is retried or submitted twice
**When** it is processed
**Then** the award pays once.

### Story 7.6: Rematch and Recalibrate

**Requirements:** FR39

As a person who missed a target,
I want a fair way to try again,
So that the next test stays hard but winnable.

**Acceptance Criteria:**

**Given** a person missed a target
**When** they book a rematch
**Then** its target sits halfway between their best and the missed target, rounded to the metric kind's increment
**And** the Chapter stays closed.

**Given** a miss
**When** the next Chapter's target is computed
**Then** it never rises above the target missed.

**Given** a rematch reaches a higher band
**When** the award is calculated
**Then** it pays only the difference
**And** total boss XP for that Chapter never exceeds the top band.

**Given** a person declines a rematch
**When** they continue
**Then** nothing is lost and no prompt repeats in a pressuring way.

### Story 7.7: Measure Mid-Goal Drop-Off

**Requirements:** FR46

As the Zandegi product owner,
I want to see where people stop and whether boss fights change it,
So that the Slice 2 decision rests on evidence.

**Acceptance Criteria:**

**Given** `docs/ANALYTICS.md` does not exist
**When** this story is complete
**Then** it defines event names, properties, and the drop-off measure
**And** `CLAUDE.md`'s analytics requirement can be met by later surfaces.

**Given** a person progresses through a Mission
**When** events are emitted
**Then** they show Chapter position, boss attempts, and return after a gap
**And** they contain no goal text, debrief text, or raw results.

**Given** collected events
**When** the owner reviews them
**Then** they can compare where people stop by Chapter position
**And** the action item for agreeing the measure can be closed.

## Epic 8: Make the Plan Yours

A person can shape the plan around real life, record unplanned progress, and see evidence of who they are becoming.

### Story 8.1: Edit the Plan

**Requirements:** FR41

As a person who knows my own situation,
I want to rewrite, reorder, add, or delete Steps,
So that the plan fits my real life.

**Acceptance Criteria:**

**Given** an owned Mission
**When** a person edits Steps
**Then** the change is saved through an explicit API use case with a version check
**And** a stale edit receives a stable conflict.

**Given** a Step already paid
**When** it is edited or deleted
**Then** its recorded award is unchanged.

**Given** a person adds Steps
**When** rewards are calculated
**Then** the per-Chapter cap applies
**And** deleting and re-adding a Step cannot pay twice.

**Given** a generated Step's text is edited
**When** it is saved
**Then** its sources are removed and it is marked as the person's own
**And** it is not sent to a model.

**Given** a person attempts to add or remove a Chapter
**When** the request is processed
**Then** it is rejected with a stable error.

### Story 8.2: Log Anything

**Requirements:** FR42

As a person who made unplanned progress,
I want to record it in seconds,
So that real wins count towards my story.

**Acceptance Criteria:**

**Given** an owned Mission
**When** a person logs a one-line note or number
**Then** it is filed under the current Chapter and can be moved
**And** no model call is made.

**Given** any log
**When** progress is calculated
**Then** it pays no XP.

**Given** Story 2.4 is not complete
**When** a person opens quick capture
**Then** photo logging is not offered.

**Given** Story 2.4 is complete
**When** a person logs a photo
**Then** it follows the private evidence lifecycle.

**Given** logs exist
**When** a person exports or deletes their data
**Then** they are included.

### Story 8.3: Declare a Busy Period

**Requirements:** FR43

As a person in a demanding stretch of life,
I want to scale my goal down without penalty,
So that I can keep the thread alive and come back.

**Acceptance Criteria:**

**Given** an owned goal
**When** a person declares a busy period
**Then** an end date is required
**And** they can extend it at any time without penalty.

**Given** an active busy period
**When** boss prompts and boss Blocks fall due
**Then** they move until after it ends.

**Given** a touch action is completed
**When** progress is calculated
**Then** it pays no XP
**And** model-written touch text must pass grounding and safety checks.

**Given** a busy period ends
**When** the person returns
**Then** the app gently offers to resume
**And** the copy contains no loss framing.

### Story 8.4: Earn Titles and Badges

**Requirements:** FR44

As a person who keeps showing up,
I want my behaviour recognised with labels I earned,
So that my identity reflects what I have actually done.

**Acceptance Criteria:**

**Given** published title rules such as three rematches for "The Unbroken"
**When** ledger facts meet a rule
**Then** the title is earned once, as a ledger fact
**And** it pays no XP.

**Given** a person closes the middle Chapter
**When** the midpoint badge is awarded
**Then** it compares first and latest results using numbers and text
**And** photos are included only after Story 2.4.

**Given** earned titles and badges
**When** a person arranges their profile
**Then** they choose from limited showcase slots
**And** gold appears only on earned value.

**Given** prompts to use a title as a self-description
**When** they appear
**Then** they are optional.

### Story 8.5: Carry Past Wins Forward

**Requirements:** FR45

As a person finding a new goal hard,
I want to see what I have already done,
So that my own history helps me believe I can do this too.

**Acceptance Criteria:**

**Given** a person misses a boss or returns after a gap
**When** they have earlier results
**Then** the app may show their own results
**And** it never compares them with other people.

**Given** a person has no earlier results
**When** the same moment occurs
**Then** nothing fabricated is shown.

**Given** a person deleted a result
**When** past wins are displayed
**Then** that result does not appear.
```

### 4.5 `epics.md`: changes to existing content

| Item | OLD | NEW |
| --- | --- | --- |
| FR7 | `...with exit conditions, guides, planning estimates, evidence methods, tools, and dated sources where factual claims are made.` | Same text, plus: `Each Chapter has one boss fight.` |
| Story 1.4 | Mission contract has no IDs or boss data. | Add AC: `Given a Mission contract, When it is validated, Then Chapters and Steps carry the stable IDs from Story 7.2, and a Chapter carries a boss descriptor and optional registered metric kind.` |
| Story 1.5 | Validates "meaningful Chapter templates and exits". | Add AC: `Given a Chapter exit, When validation runs, Then it works as a real-act trial depending only on the person's own actions.` |
| Story 1.18 | Validates "meaningful Chapters with exit conditions". | Add AC with the same rule for generated exits. |
| Story 2.1 | `Given the product owner has approved neutral rewards, authored bands, caps, level curve, and provisional thresholds, When the core progression policy is published...` | `Given the progression-v2 policy from Story 7.1 and approved provisional thresholds, When the ledger contracts are published...`. Add boss events to the event registry. |
| Story 2.2 | No mention of the demo ledger. | Add AC: `Given the demo ProgressLedgerPort, When this story completes, Then Postgres replaces it behind the same port with atomic writes, and the migrate-or-retire decision for demo data is recorded.` |
| Story 2.5 | Covers Step completion. | Add AC: `Given a boss attempt command, When it is processed, Then it uses the same idempotent, atomic path.` |
| Story 3.1 | "Mission Steps" | "Mission Steps and boss fights" |
| Story 3.2 | See below. | See below. |
| Story 4.1 | `owned Goals, Missions, evidence, tools, events, and projections remain linked once.` | Add: debriefs, logs, person-written Steps, and boss results. |
| Story 4.2 | `owned profile data, Goals, Missions, schedules, tool state, evidence metadata, award explanations, and applicable settings` | Add: debriefs, logs, person-written Steps, and raw boss results. |
| Story 4.3 | `personal relational content, private evidence and exports, caches, tool state, schedules, and identity mappings` | Add: debriefs, logs, person-written Steps, and raw boss results. |
| Story 6.3 | Chapters, exits, Steps, tools, evidence. | Add: boss fights, debriefs, plan editing, logs, and busy periods. |
| Story 6.4 | Progression display. | Add: titles, badges, and showcase slots. |
| Story 6.5 | `schedule and complete an eligible Step, receive authoritative progression, and claim an account` | Add: attempt a boss fight and close a Chapter. |

**Story 3.2: add after the "falls below 0.45" criterion.**

```markdown
**Given** a person accepts a recovery Chapter
**When** boss targets are recalculated
**Then** the formula uses the new number of Chapters left
**And** no existing target rises.

**Given** a person is in a declared busy period, or a Step is person-written
**When** adaptive sizing runs
**Then** busy days are left out of the completion rate
**And** person-written Steps are never resized.
```

**`deferred-work.md`.** In the item on `apps/**` importing `@zandegi/core` root, record that the product decision is settled: under AD-5, a client screen may not show XP before completion. The import-boundary work stays open.

**Justification.** Keeps existing stories consistent with the approved rules. Without these changes, export and deletion would miss personal records.

### 4.6 `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Add.**

```yaml
  # Slice 1. Runs before the remaining Epic 2 stories; needs the action items below.
  epic-7: backlog
  7-1-publish-the-progression-v2-reward-policy: backlog
  7-2-give-chapters-and-steps-stable-ids: backlog
  7-3-capture-baseline-and-goal-number-at-intake: backlog
  7-4-show-each-chapters-boss-fight: backlog
  7-5-attempt-debrief-and-close-a-chapter: backlog
  7-6-rematch-and-recalibrate: backlog
  7-7-measure-mid-goal-drop-off: backlog
  epic-7-retrospective: optional

  # Slice 2.
  epic-8: backlog
  8-1-edit-the-plan: backlog
  8-2-log-anything: backlog
  8-3-declare-a-busy-period: backlog
  8-4-earn-titles-and-badges: backlog
  8-5-carry-past-wins-forward: backlog
  epic-8-retrospective: optional
```

**Change.**

```yaml
  1-3-put-mission-generation-behind-the-api-boundary: done  # AC1 gap tracked in deferred-work.md
  1-16-create-a-secure-guest-and-persist-their-goal: in-progress  # demo slice shipped; cleanup and Postgres criteria remain
  1-19-stream-and-persist-one-accepted-mission: in-progress  # demo slice shipped; Postgres and outbox criteria remain
  2-5-complete-a-step-and-receive-an-atomic-award: backlog  # demo version shipped in d81c419, not atomic
```

**Replace `action_items` with.**

```yaml
action_items:
  - epic: 1
    action: "Approve warning timing, renewal rules, and evidence cleanup before Story 1.16 closes. The demo uses 30 days of inactivity (build log)"
    owner: "Product"
    status: open
  - epic: 7
    action: "Approve step reward and per-Chapter cap, boss bands, target cap, fixed mission reward, level curve, and provisional-review thresholds before Story 7.1"
    owner: "Product"
    status: open
  - epic: 7
    action: "Create and approve the DESIGN.md and EXPERIENCE.md UX contract, including boss fights, before Story 7.3. CLAUDE.md expects docs/DESIGN.md"
    owner: "UX"
    status: open
  - epic: 7
    action: "Approve the registered metric kinds before Story 7.3"
    owner: "Product"
    status: open
  - epic: 8
    action: "Agree the drop-off measure from Story 7.7 before Epic 8 starts"
    owner: "Product"
    status: open
```

Also set `last_updated`.

**Justification.** The file was last changed on 7 October and omits the work from 8–9 October. Stories 1.16 and 1.19 shipped as demo slices that do not meet their Postgres-backed criteria, so `review` overstates them.

**Known mismatch left alone.** Story 1.1's spec says `in-progress` while the status file says `done`. The build log verifies the work, so the spec's status field appears stale.

## 5. Implementation handoff

**Scope: Moderate.** Backlog reorganisation and targeted spec and architecture edits, with no fundamental replan. The product owner has already made the strategic decisions.

| Role | Responsibility |
| --- | --- |
| Developer agent | Apply the edits in sections 4.1–4.6 exactly. Then build Stories 7.1 and 7.2 once the reward numbers are approved. |
| Product owner (Aadi) | Approve the reward numbers, registered metric kinds, and later the drop-off measure. Commit the changes. |
| UX | Create `DESIGN.md` and `EXPERIENCE.md` covering boss fights before Story 7.3. |

**Sequence.**

1. Apply the document edits and update `sprint-status.yaml`.
2. Approve the reward numbers. These unblock Story 7.1.
3. Build Stories 7.1 and 7.2, which have no screens.
4. Create the UX contract and approve the registered metric kinds.
5. Build Stories 7.3 to 7.6, with Story 7.7 alongside.
6. Review the drop-off measure, then start Epic 8.
7. Complete Story 2.2 before production launch.

**Success criteria.**

- `SPEC.md`, `product-rules.md`, the spine, `epics.md`, and `sprint-status.yaml` agree, with no contradiction on boss fights, rewards, or personal text.
- Every new FR maps to a story, and every story has full acceptance criteria.
- `sprint-status.yaml` lists Epics 7 and 8 and the corrected statuses.
- After Story 7.2, folded XP for existing ledgers is identical, proven by golden fixtures.
- After Slice 1, a person can state a metric goal, see a target, attempt it, debrief, close the Chapter, and receive a capped award, with no XP promise beforehand.
- The drop-off measure is agreed before Epic 8 starts.

## 6. Checklist record

| Item | Status | Note |
| --- | --- | --- |
| 1.1 Triggering story | [N/A] | Strategic change; nearest work is `d81c419` |
| 1.2 Core problem | [x] | Strategic product change |
| 1.3 Evidence | [x] | Code evidence, plus labelled hypotheses |
| 2.1 Current epic | [N/A] | No single epic triggered it |
| 2.2 Epic-level changes | [x] | Two new epics |
| 2.3 Remaining epics | [x] | Epics 1–4 and 6 modified; Epic 5 unaffected |
| 2.4 Invalidated or new epics | [x] | None invalidated; Epics 7 and 8 added |
| 2.5 Order | [x] | Epic 7 before the remaining Epic 2 stories |
| 3.1 Spec conflicts (no separate PRD) | [x] | Section 4.1 |
| 3.2 Architecture | [x] | Section 4.3 |
| 3.3 UI/UX | [!] | UX contract does not exist; action item open |
| 3.4 Other artifacts | [!] | `docs/ANALYTICS.md` missing; Story 7.7 creates it |
| 4.1 Direct Adjustment | [x] | Viable; selected |
| 4.2 Rollback | [x] | Not viable |
| 4.3 MVP Review | [x] | Not needed |
| 4.4 Recommended path | [x] | Direct Adjustment in two slices |
| 5.1–5.5 Proposal components | [x] | This document |
| 6.1 Checklist review | [x] | Open [!] items are recorded as action items |
| 6.2 Proposal accuracy | [x] | Consistency checked against sections 1–4 |
| 6.3 User approval | [x] | Each edit approved, and final approval given on 3 November 2026 |
| 6.4 Update sprint status | [x] | Applied |
| 6.5 Next steps | [x] | Section 5 |
