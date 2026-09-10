/**
 * Level curve and rank thresholds (SPEC §4.2). Pure.
 *
 *   xpForLevel(n) = round(100 × n^1.6)   // cumulative XP to *reach* level n
 *
 * Level 1 costs 0. Level 10 ≈ 4.0k, level 25 ≈ 17.5k, level 50 ≈ 53k,
 * level 100 ≈ 160k.
 */

const LEVEL_BASE = 100;
const LEVEL_EXP = 1.6;
export const MAX_LEVEL = 500;

export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  if (n === 1) return 0;
  return Math.round(LEVEL_BASE * Math.pow(n, LEVEL_EXP));
}

// Precomputed cumulative thresholds for a fast, exact levelFromXp.
const THRESHOLDS: number[] = (() => {
  const arr: number[] = [];
  for (let l = 1; l <= MAX_LEVEL; l++) arr.push(xpForLevel(l));
  return arr;
})();

export function levelFromXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  // THRESHOLDS is ascending; find the highest level whose threshold xp meets.
  let level = 1;
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (xp >= (THRESHOLDS[i] ?? Infinity)) level = i + 1;
    else break;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForThisLevel: number;
  xpToNextLevel: number;
  progressPct: number;
  isMax: boolean;
}

export function levelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = xp - floor;
  return {
    level,
    xpIntoLevel: into,
    xpForThisLevel: span,
    xpToNextLevel: Math.max(0, ceil - xp),
    progressPct: level >= MAX_LEVEL ? 100 : Math.min(100, Math.round((into / span) * 100)),
    isMax: level >= MAX_LEVEL,
  };
}

// ── Ranks (SPEC §4.2) ──────────────────────────────────────

export const RANKS = [
  { name: "Wanderer", fromLevel: 1 },
  { name: "Seeker", fromLevel: 10 },
  { name: "Adept", fromLevel: 20 },
  { name: "Vanguard", fromLevel: 35 },
  { name: "Ascendant", fromLevel: 55 },
  { name: "Mythic", fromLevel: 80 },
  { name: "Eternal", fromLevel: 100 },
] as const;

export type Rank = (typeof RANKS)[number]["name"];

export function rankForLevel(level: number): Rank {
  const l = Math.max(1, Math.floor(level));
  let rank: Rank = RANKS[0].name;
  for (const r of RANKS) {
    if (l >= r.fromLevel) rank = r.name;
    else break;
  }
  return rank;
}
