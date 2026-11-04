# Intent: rethink goal progression

Source: `.memlog.md` in this folder (brainstorm, 2026-11-01). Input for `bmad-correct-course`.
Nothing here overrides the spec until a Sprint Change Proposal is approved.

## Problem

Progress is a pile of ticks: a step pays 40 XP for a check or 50 for a photo, plus chapter and mission bonuses. It does not feel rewarding, and the path has no moments that prove anything changed. The owner wants progression more rewarding and better structured.

## The need underneath

Self-efficacy: the belief "I can grow myself as a person." XP, badges and tests matter only as evidence of that belief. Three observations shape the design:

- People quit in the middle of a long goal, not at the start or the finish.
- Checkpoints set too hard make people stop.
- Seeing friends progress pulls people along (acted on post-MVP).

## Decision: solo first

The MVP stays solo. Crews, video proof and integrations are the first post-MVP release, which keeps the spec's existing non-goals intact for now.

## Into the MVP

1. **Boss fights.** Each chapter has a real-world test of what the person can now do.
   - Metric goals test a number: 3 weeks from a 60kg bench means attempting 65kg.
   - Outcome goals test a real act: order a meal in Farsi, sit a timed practice paper. They show no percentage.
   - Targets are visible from the start of the chapter.
2. **Any gain counts.** Any attempt above baseline is progress to be proud of, and XP pays on the gain rather than on pass or fail.
3. **Rematches.** A miss books a rematch, and the next target recalibrates so it stays hard but winnable.
4. **Debrief.** After each boss fight the person notes tips, what went well, what didn't, and what they'll improve. "What I'll improve" becomes the opening steps of the next chapter.
5. **User-owned plans.** The AI drafts the plan and the person can rewrite, reorder, add or delete steps.
6. **Log anything.** A one-line note, photo or number is filed under the right chapter, so unplanned wins count. Logs build the goal's story and do not farm XP.
7. **Busy-period mode.** The person declares a busy period such as exams. The goal drops to small touch actions such as a 5-minute video, progress is protected, and boss fights move to afterwards.
8. **Earned titles and badges.** Identity labels are unlocked by real behaviour, such as "The Unbroken" after 3 rematches, and are shown on the profile with limited showcase slots. A midpoint badge shows week-1 against week-6 evidence. The labelling technique prompts people to use these labels about themselves.
9. **Past wins carry forward.** When a new goal gets hard, the app shows the person's own earlier proof.

## Rules that bind this work

- **AI never sets boss targets, XP or difficulty (law 5).** Metric targets come from a published `core` formula. AI may write outcome-trial text, which must pass the grounding validator.
- **No numeric XP promise before completion (architecture).** Showing a target weight is fine; showing the XP it will pay is not.
- **Merely using a tool earns nothing (spec).** Touch actions pay no XP.
- **Evidence kinds stay as they are.** Boss proof maps to `METRIC` or `ARTIFACT` from the existing narrow file allowlist.
- **No shaming (law 8).** The app may call a plan too tight. It never judges the person or their circumstances, and a miss is never framed as a loss.
- **Busy periods are declared by hand.** External calendar sync is a non-goal.

## Post-MVP (recorded, not authorised)

- Crew raids on a shared boss, where each member's own checkpoint deals damage relative to their own baseline, with a 2-day retry and assists.
- Spotter pairs, crew tiers (Super Team, All-Star), crew streaks, season map, leagues, Sunday huddle, crew progress feed.
- Video proof with a challenge code, witness proof, integrations as proof, and a plausibility check that asks for stronger proof.
- Gold badge variants for strong proof, real rarity statistics (these need enough users to mean anything), and a private tier for self-reported results.
- Shareable boss-fight cards for group chats. These could move into the MVP if they are only an exported image.
- Calendar-aware pacing.

**Needs a rule change before it can be built:** the full-crew XP bonus. The spec says engagement never increases XP. Decide this when crews are scoped.

## Open questions for Correct Course

1. **Does a chapter close on a miss?** The ideas conflict: "closes only on a pass" against "a miss never locks the chapter". Suggested: any attempt above baseline closes the chapter, and the rematch stays optional for the higher reward.
2. **Can edited plans farm XP?** Steps still pay under `neutral-v1`, so unlimited self-written steps could be used to earn it. Suggested: cap or cut step XP and move the weight to boss fights. Decide alongside the open action item on approving rewards, caps and the level curve.
3. **What is the boss target formula?** It needs inputs for baseline, rate and recalibration, plus handling for goals where progress is not linear.
4. **How is an outcome-goal boss proven and paid?** There is no number to measure a gain against, and a photo may not show the act.
5. **What happens to the existing bonuses?** Today a chapter pays 2.5x its steps and a mission pays 4x its largest chapter. Decide whether boss fights replace these. Ledger history must stay replayable under `neutral-v1`.
6. **What does busy-period mode protect?** Decide how streaks behave, and whether there is a limit that stops it being left on permanently.

## Likely impact

- **Spec and rules:** `SPEC.md` capabilities, `product-rules.md`.
- **Architecture:** the progression policy decision and the new `core` formulas.
- **Epics:** Epic 2 (progression), Epic 3 (Story 3.2 recovery and adaptation), Epic 6 (surfaces).
- **Also reconcile:** `sprint-status.yaml` is behind the code (XP and ledger work landed after its last commit), and `docs/DESIGN.md` and `docs/ANALYTICS.md`, which `CLAUDE.md` requires, do not exist.
