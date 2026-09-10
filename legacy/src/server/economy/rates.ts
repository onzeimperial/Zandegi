/**
 * Pure coin-earning maths. No IO — unit tested (test/economy.test.ts).
 *
 * Coins are the spendable currency. XP remains the permanent progression
 * metric, so spending coins never affects levels or achievements.
 */

import type { Rarity } from "@/lib/constants";

/** Fraction of a task's XP award that also drops as coins. */
const TASK_COIN_RATIO = 0.35;

/** Fraction of a streak XP bonus that also drops as coins. */
const STREAK_COIN_RATIO = 0.3;

const BRONZE_COINS = 50;

const ACHIEVEMENT_TIER_COINS: Record<string, number> = {
  bronze: BRONZE_COINS,
  silver: 120,
  gold: 300,
  platinum: 800,
};

export function coinsForTask(xpAwarded: number): number {
  return Math.max(1, Math.round(xpAwarded * TASK_COIN_RATIO));
}

export function coinsForMilestone(orderIndex: number): number {
  return 150 + 25 * Math.max(0, Math.floor(orderIndex));
}

export function coinsForGoalCompletion(difficulty: number): number {
  return 400 * clampDifficulty(difficulty);
}

export function coinsForAchievement(tier: string): number {
  return ACHIEVEMENT_TIER_COINS[tier] ?? BRONZE_COINS;
}

export function coinsForStreak(bonusXp: number): number {
  if (bonusXp <= 0) return 0;
  return Math.max(1, Math.round(bonusXp * STREAK_COIN_RATIO));
}

export function coinsForLevelUp(newLevel: number): number {
  return 50 * Math.max(1, Math.floor(newLevel));
}

/**
 * How "big" a goal is, 0..100. Drives the guaranteed rarity floor of the
 * cosmetic gifted when the goal completes, so a 40-week grind rewards
 * meaningfully better than a 4-week one.
 */
export function goalScaleScore(params: {
  difficulty: number;
  targetLevel: number;
  timelineWeeks?: number | null;
}): number {
  const difficulty = clampDifficulty(params.difficulty);
  const targetLevel = Math.max(1, params.targetLevel);
  const weeks = Math.max(1, params.timelineWeeks ?? 12);

  // Reference ceiling: difficulty 5, target level 28, 72 weeks — the largest
  // plan heuristicDecompose produces.
  const raw = difficulty * targetLevel * weeks;
  const ceiling = 5 * 28 * 72;

  // Square root, not linear. The raw product grows so fast that a linear map
  // leaves every realistic goal clustered near zero (a hard 40-week goal
  // scored 38/100), making the top rarities unreachable in practice.
  const normalized = Math.sqrt(Math.min(1, raw / ceiling));
  return clamp(Math.round(normalized * 100), 0, 100);
}

/** Rarity floor guaranteed by a goal's scale score. */
export function rarityFloorForScale(scale: number): Rarity {
  if (scale < 20) return "common";
  if (scale < 40) return "uncommon";
  if (scale < 60) return "rare";
  if (scale < 80) return "epic";
  if (scale < 95) return "legendary";
  return "mythic";
}

function clampDifficulty(d: number): number {
  return clamp(Math.round(d), 1, 5);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
