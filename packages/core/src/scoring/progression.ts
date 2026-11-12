/**
 * `progression-v2`: the reward policy for events recorded from boss fights on
 * (Stories 7.1, 7.4, 7.5). Pure, and the only place these numbers live.
 *
 * What changed from `neutral-v1`, and why:
 *   - Chapter and mission bonuses no longer scale with step count. Under
 *     `neutral-v1` most XP came from finishing lists, which proves nothing
 *     changed in a person's life. Here a chapter pays for its boss -- a real act
 *     taken from the chapter's exit condition -- and a mission pays a fixed
 *     reward once every boss is beaten.
 *   - Step XP per chapter is capped, counted from amounts already in the
 *     ledger, so a long chapter cannot out-earn its boss.
 *
 * Every function takes only an evidence kind, a boss band and amounts already
 * recorded in the ledger (law 5). Nothing a model writes and nothing a client
 * totals reaches them. `neutral-v1` is untouched: events it priced keep their
 * stored amounts, and a fold never recalculates a stored amount (law 4).
 *
 * The level curve is unchanged: `round(100 × n^1.6)` in `./levels`.
 */

import type { StepAward } from "./award";

/** Stamped on every award this policy prices. */
export const PROGRESSION_V2_VERSION = "progression-v2";

/** The evidence a step or boss under this policy accepts (law 3). */
export const PROGRESSION_V2_EVIDENCE = ["SELF", "ARTIFACT"] as const;
export type ProgressionV2Evidence = (typeof PROGRESSION_V2_EVIDENCE)[number];

/** How a boss attempt ended. There is no "partly" band. */
export const BOSS_BANDS = ["done", "not-yet"] as const;
export type BossBand = (typeof BOSS_BANDS)[number];

/**
 * Every tunable value in `progression-v2`, with its rationale. Decided by the
 * human on 2026-11-12. Changing any value means a new version, never an edit:
 * a recorded award must always be explainable from the version it carries.
 */
export const PROGRESSION_V2 = Object.freeze({
  version: PROGRESSION_V2_VERSION,
  /** Same as `neutral-v1`, so a step is worth what it always was. A photo is stronger evidence. */
  stepXp: Object.freeze({ SELF: 40, ARTIFACT: 50 }),
  /**
   * The most step XP one chapter pays, counted from the ledger. Above any
   * ordinary chapter, so it only bites a chapter padded with steps.
   */
  chapterStepXpCap: 450,
  /**
   * A beaten boss is worth more than the chapter's steps together: the real
   * act is the proof. A photo adds a little. "Not yet" pays nothing, and the
   * chapter can be tried again for the done band.
   */
  boss: Object.freeze({ done: 400, photoBonus: 50, notYet: 0 }),
  /** Fixed, whatever the step count, paid once every boss reaches "done". */
  missionXp: 1500,
} as const);

function assertEvidence(evidence: string): asserts evidence is ProgressionV2Evidence {
  if (!(PROGRESSION_V2_EVIDENCE as readonly string[]).includes(evidence)) {
    // METRIC, TIMER and INTEGRATION are not accepted under this policy.
    throw new RangeError(`evidence ${evidence} is not accepted by ${PROGRESSION_V2_VERSION}`);
  }
}

function assertAmount(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

/**
 * A generated step's award. `chapterStepXpPaid` is the step XP the ledger
 * already holds for this chapter; the award is cut so the chapter never pays
 * more than the cap, and is 0 once it is reached.
 */
export function progressionV2StepAward(
  evidence: ProgressionV2Evidence,
  chapterStepXpPaid: number,
): StepAward {
  assertEvidence(evidence);
  assertAmount("chapterStepXpPaid", chapterStepXpPaid);
  const reward = PROGRESSION_V2.stepXp[evidence];
  const room = Math.max(0, PROGRESSION_V2.chapterStepXpCap - chapterStepXpPaid);
  return {
    xp: Math.min(reward, room),
    base: reward,
    // The evidence table already prices the evidence, so there is no multiplier.
    verificationMult: 1,
    calculatorVersion: PROGRESSION_V2_VERSION,
  };
}

/** What a boss attempt is worth. */
export interface BossAward {
  xp: number;
  band: BossBand;
  evidence: ProgressionV2Evidence;
  calculatorVersion: string;
}

/** A boss attempt's award, from its band and the evidence offered. */
export function progressionV2BossAward(band: BossBand, evidence: ProgressionV2Evidence): BossAward {
  assertEvidence(evidence);
  if (!(BOSS_BANDS as readonly string[]).includes(band)) {
    throw new RangeError(`band ${band} is not a boss band`);
  }
  const { boss } = PROGRESSION_V2;
  const xp =
    band === "done" ? boss.done + (evidence === "ARTIFACT" ? boss.photoBonus : 0) : boss.notYet;
  return { xp, band, evidence, calculatorVersion: PROGRESSION_V2_VERSION };
}

/**
 * The mission reward, from each boss chapter's best band so far as the ledger
 * records it (`null` for a boss not yet attempted). It pays only when there is
 * at least one boss and every one of them is "done", try-again included.
 */
export function progressionV2MissionAward(bossBands: readonly (BossBand | null)[]): number {
  return bossBands.length > 0 && bossBands.every((band) => band === "done")
    ? PROGRESSION_V2.missionXp
    : 0;
}
