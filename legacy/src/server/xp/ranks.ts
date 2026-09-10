/**
 * Rank titles per level band. Pure — no IO, unit tested (test/ranks.test.ts).
 *
 * Levels already exist on Profile, Goal and Skill; ranks are presentation on
 * top of them, so a number like "level 23" reads as progress rather than a
 * bare integer.
 */

import { MAX_LEVEL } from "./levels";

export interface Rank {
  /** Lowest level in this band. */
  from: number;
  name: string;
  /** Hex colour used for the badge. */
  color: string;
}

export const RANKS: Rank[] = [
  { from: 1, name: "Novice", color: "#9ca3af" },
  { from: 5, name: "Apprentice", color: "#22c55e" },
  { from: 12, name: "Adept", color: "#14b8a6" },
  { from: 22, name: "Practitioner", color: "#3b82f6" },
  { from: 35, name: "Expert", color: "#8b5cf6" },
  { from: 55, name: "Master", color: "#a855f7" },
  { from: 80, name: "Grandmaster", color: "#f59e0b" },
  { from: 120, name: "Legend", color: "#ef4444" },
  { from: 170, name: "Mythic", color: "#ec4899" },
];

export function rankForLevel(level: number): Rank {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  let current = RANKS[0]!;
  for (const r of RANKS) {
    if (l >= r.from) current = r;
    else break;
  }
  return current;
}

/** The next rank up, or null at the top band. */
export function nextRank(level: number): Rank | null {
  const l = Math.max(1, Math.floor(level));
  return RANKS.find((r) => r.from > l) ?? null;
}

/** Levels remaining until the next rank, or null at the top band. */
export function levelsToNextRank(level: number): number | null {
  const next = nextRank(level);
  return next ? next.from - Math.max(1, Math.floor(level)) : null;
}
