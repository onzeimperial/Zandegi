/**
 * The XP formula (SPEC §4.1). Pure — every input is passed in, nothing is
 * read from a clock, a database, or the model (CLAUDE.md §2.5).
 *
 * The stateful layer on top of this — daily soft caps, per-pursuit caps, the
 * 90-second minimum interval, the trust score, provisional XP — is built in
 * `@zandegi/economy` in session 3. This file is only the raw award maths.
 */

import { verificationMult } from "../verification";
import type { VerificationMethod } from "../verification";

export const STEP_XP_MIN = 5;
export const STEP_XP_MAX = 900;
const BASE_MINUTES_MIN = 5;
const BASE_MINUTES_MAX = 240;
const DIFFICULTY_MULT_MIN = 0.5;
const DIFFICULTY_MULT_MAX = 2.0;
const STREAK_MULT_CAP = 0.25;
const STREAK_MULT_PER_DAY = 0.01;
const BALANCE_MULT_WEAKEST = 1.1;
const RARITY_MULT_RANGE = 0.5;
const CHAPTER_XP_FACTOR = 2.5;
const MISSION_XP_FACTOR = 4;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** One minute of real effort ≈ one point, bounded (SPEC §4.1). */
export function stepBaseXp(estimatedMinutes: number): number {
  return clamp(Math.round(estimatedMinutes), BASE_MINUTES_MIN, BASE_MINUTES_MAX);
}

/**
 * `pursuit.difficultyPrior × userAdaptive`, clamped to [0.5, 2.0].
 * difficultyPrior is seeded 0.5–2.0 and learned from population data;
 * userAdaptive comes from the per-user adaptive-difficulty loop (SPEC §2.3).
 */
export function difficultyMult(difficultyPrior: number, userAdaptive: number): number {
  return clamp(difficultyPrior * userAdaptive, DIFFICULTY_MULT_MIN, DIFFICULTY_MULT_MAX);
}

/** `1 + min(0.25, 0.01 × streakDays)` — caps at a 25% bonus by day 25. */
export function streakMult(currentStreakDays: number): number {
  return 1 + Math.min(STREAK_MULT_CAP, STREAK_MULT_PER_DAY * Math.max(0, currentStreakDays));
}

/** +10% when the step's domain is the user's weakest of eight (SPEC §4.1). */
export function balanceMult(isWeakestDomain: boolean): number {
  return isWeakestDomain ? BALANCE_MULT_WEAKEST : 1.0;
}

/**
 * `1 + 0.5 × rarityScore`, where **rarityScore ∈ [0, 1] is exclusivity**:
 * `1 − (fraction of users who have the achievement)`. Higher = rarer = pays
 * more (SPEC §4.1 comment "rarer achievements pay more"). Passing the raw
 * population fraction here would invert the intent — use
 * `rarityScoreFromPopulation` from ./rarity to convert.
 */
export function rarityMult(rarityScore: number): number {
  return 1 + RARITY_MULT_RANGE * clamp(rarityScore, 0, 1);
}

export interface StepXpInput {
  estimatedMinutes: number;
  difficultyPrior: number;
  userAdaptive: number;
  verification: VerificationMethod;
  currentStreakDays: number;
  isWeakestDomain: boolean;
  /** Exclusivity in [0, 1] — see `rarityMult`. Defaults to 0 (not rare). */
  rarityScore?: number;
}

export interface StepXpResult {
  xp: number;
  base: number;
  multipliers: {
    difficulty: number;
    verification: number;
    streak: number;
    balance: number;
    rarity: number;
  };
  /** Product before clamp/round — kept for "why did my XP change" debugging. */
  raw: number;
}

/** The full step award, with a breakdown for auditability (CLAUDE.md §2.4). */
export function stepXp(input: StepXpInput): StepXpResult {
  const base = stepBaseXp(input.estimatedMinutes);
  const multipliers = {
    difficulty: difficultyMult(input.difficultyPrior, input.userAdaptive),
    verification: verificationMult(input.verification),
    streak: streakMult(input.currentStreakDays),
    balance: balanceMult(input.isWeakestDomain),
    rarity: rarityMult(input.rarityScore ?? 0),
  };
  const raw =
    base *
    multipliers.difficulty *
    multipliers.verification *
    multipliers.streak *
    multipliers.balance *
    multipliers.rarity;
  return { xp: clamp(Math.round(raw), STEP_XP_MIN, STEP_XP_MAX), base, multipliers, raw };
}

/** Chapter completion = 2.5× the sum of its steps' *base* XP (SPEC §4.1). */
export function chapterCompletionXp(stepBaseXps: readonly number[]): number {
  const sum = stepBaseXps.reduce((a, b) => a + b, 0);
  return Math.round(CHAPTER_XP_FACTOR * sum);
}

/** Mission completion = 4× the largest chapter award (SPEC §4.1). */
export function missionCompletionXp(chapterAwards: readonly number[]): number {
  if (chapterAwards.length === 0) return 0;
  return Math.round(MISSION_XP_FACTOR * Math.max(...chapterAwards));
}
