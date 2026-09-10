/**
 * Pure level-curve maths. No IO. Fully unit-tested (test/xp.test.ts).
 *
 * Design: each level costs progressively more XP. The curve is smooth,
 * predictable, and cheap to invert.
 *
 *   xpToNext(L)  = round(BASE * L^EXP)        // cost of going L -> L+1
 *   xpForLevel(L) = Σ xpToNext(i) for i in 1..L-1   // cumulative to reach L
 */

const BASE = 80;
const EXP = 1.45;
export const MAX_LEVEL = 200;

export function xpToNext(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return Math.round(BASE * Math.pow(l, EXP));
}

const cumulative: number[] = (() => {
  const arr = [0, 0]; // index 0 unused, level 1 => 0
  for (let l = 2; l <= MAX_LEVEL + 1; l++) {
    // Written in ascending order, so arr[l - 1] is always present. The ?? 0
    // satisfies noUncheckedIndexedAccess without changing behaviour.
    arr[l] = (arr[l - 1] ?? 0) + xpToNext(l - 1);
  }
  return arr;
})();

export function xpForLevel(level: number): number {
  const l = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  return cumulative[l] ?? 0;
}

export function levelFromXp(xp: number): number {
  const clamped = Math.max(0, Math.floor(xp));
  // linear scan is fine — MAX_LEVEL is small and this is called rarely
  let level = 1;
  while (level < MAX_LEVEL && clamped >= (cumulative[level + 1] ?? Infinity)) {
    level++;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForThisLevel: number;
  xpToNextLevel: number;
  progressPct: number;
  isMax: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = xp - floor;
  return {
    level,
    xp,
    xpIntoLevel: into,
    xpForThisLevel: span,
    xpToNextLevel: Math.max(0, ceil - xp),
    progressPct: level >= MAX_LEVEL ? 100 : Math.min(100, Math.round((into / span) * 100)),
    isMax: level >= MAX_LEVEL,
  };
}
