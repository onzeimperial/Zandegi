/**
 * The award paid for a completed step, chapter and mission (SPEC §4.1, law 5).
 *
 * Why not `stepXp` from `./xp`: its base is `stepBaseXp(estimatedMinutes)`,
 * and `estimatedMinutes` is written by the model. Using it at completion would
 * let a model that rates a step at 300 minutes make that step worth seven
 * times a 40-minute one -- the same law-5 problem removed from generation in
 * Story 1.3. Here every step has the same neutral base, and the only thing a
 * person can change is the strength of their evidence.
 *
 * The numbers are provisional pending the Product gate on reward bands, caps
 * and the level curve (sprint action item for Story 2.1). They are versioned,
 * so a later change never rewrites an award already recorded.
 */

import { verificationMult, type VerificationMethod } from "../verification";
import { chapterCompletionXp, missionCompletionXp } from "./xp";

/** Every step's base, whatever the model estimated. Matches the builder board. */
export const NEUTRAL_STEP_BASE_XP = 40;

/**
 * Stamped on every recorded award. Bump it when any number here changes, so
 * "why did my XP change?" is answerable from the ledger alone.
 */
export const AWARD_CALCULATOR_VERSION = "neutral-v1";

/** FR18: INTEGRATION evidence produces no award in the MVP. */
export const AWARDING_METHODS = ["SELF", "TIMER", "ARTIFACT", "METRIC"] as const;
export type AwardingMethod = (typeof AWARDING_METHODS)[number];

export function isAwardingMethod(method: VerificationMethod): method is AwardingMethod {
  return (AWARDING_METHODS as readonly string[]).includes(method);
}

export interface StepAward {
  xp: number;
  base: number;
  verificationMult: number;
  calculatorVersion: string;
}

/** A step's award, from the evidence the person actually provided. */
export function neutralStepAward(method: AwardingMethod): StepAward {
  const multiplier = verificationMult(method);
  return {
    xp: Math.round(NEUTRAL_STEP_BASE_XP * multiplier),
    base: NEUTRAL_STEP_BASE_XP,
    verificationMult: multiplier,
    calculatorVersion: AWARD_CALCULATOR_VERSION,
  };
}

/** The bonus for finishing a chapter of `stepCount` steps. */
export function neutralChapterAward(stepCount: number): number {
  if (!Number.isInteger(stepCount) || stepCount < 0) {
    throw new RangeError("stepCount must be a non-negative integer");
  }
  return chapterCompletionXp(Array.from({ length: stepCount }, () => NEUTRAL_STEP_BASE_XP));
}

/** The bonus for finishing a mission, from its chapters' own bonuses. */
export function neutralMissionAward(chapterStepCounts: readonly number[]): number {
  return missionCompletionXp(chapterStepCounts.map(neutralChapterAward));
}
