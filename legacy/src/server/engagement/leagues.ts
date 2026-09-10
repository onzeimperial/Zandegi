/**
 * League season maths. Pure — no IO, unit tested (test/leagues.test.ts).
 *
 * Seasons are weekly and derived from the clock rather than stored schedules,
 * so a season always exists without a cron job having to create one.
 */

import { DIVISIONS, type Division, type LeagueOutcome } from "@/lib/constants";

const WEEK_MS = 7 * 86_400_000;
/** Monday 00:00 UTC, 5 Jan 1970 — the first full week of the epoch. */
const EPOCH_MONDAY = Date.UTC(1970, 0, 5);

/** Deterministic season number for any instant. */
export function seasonIndexFor(now: Date = new Date()): number {
  return Math.floor((now.getTime() - EPOCH_MONDAY) / WEEK_MS);
}

export function seasonWindow(index: number): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(EPOCH_MONDAY + index * WEEK_MS);
  return { startsAt, endsAt: new Date(startsAt.getTime() + WEEK_MS) };
}

/** How many at the top go up, and how many at the bottom go down. */
export const PROMOTE_COUNT = 5;
export const RELEGATE_COUNT = 5;
/** Below this, nobody is relegated — a small league shouldn't gut itself. */
export const MIN_SIZE_FOR_RELEGATION = 12;

export function divisionRank(d: Division): number {
  return DIVISIONS.indexOf(d);
}

export function promote(d: Division): Division {
  return DIVISIONS[Math.min(DIVISIONS.length - 1, divisionRank(d) + 1)]!;
}

export function relegate(d: Division): Division {
  return DIVISIONS[Math.max(0, divisionRank(d) - 1)]!;
}

export interface Standing {
  userId: string;
  xp: number;
}

export interface SettledStanding extends Standing {
  rank: number;
  outcome: LeagueOutcome;
  nextDivision: Division;
}

/**
 * Rank a division and decide who moves. Ties are broken by user id so results
 * are stable rather than dependent on query order.
 *
 * Nobody is relegated out of the bottom division, nobody is promoted beyond
 * the top one, and members with zero XP never promote — turning up is not
 * the same as competing.
 */
export function settleDivision(
  division: Division,
  standings: Standing[],
): SettledStanding[] {
  const sorted = [...standings].sort(
    (a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId),
  );

  const atTop = divisionRank(division) === DIVISIONS.length - 1;
  const atBottom = divisionRank(division) === 0;
  const relegationApplies = !atBottom && sorted.length >= MIN_SIZE_FOR_RELEGATION;
  const relegationCutoff = sorted.length - RELEGATE_COUNT;

  return sorted.map((s, i) => {
    let outcome: LeagueOutcome = "held";

    if (!atTop && i < PROMOTE_COUNT && s.xp > 0) {
      outcome = "promoted";
    } else if (relegationApplies && i >= relegationCutoff) {
      outcome = "relegated";
    }

    const nextDivision =
      outcome === "promoted" ? promote(division) : outcome === "relegated" ? relegate(division) : division;

    return { ...s, rank: i + 1, outcome, nextDivision };
  });
}
