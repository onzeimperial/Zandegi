/**
 * Adapting the daily load to recent completion (Story 3.2, simplified).
 *
 * Over the last seven local days before today, compare the minutes of steps
 * completed with the minutes those days could hold. Above 0.85, the load grows
 * by 15%. Below 0.45, it shrinks by 20%. Only the load changes: no step is
 * resized, rewritten or removed, and nothing here touches XP.
 *
 * Today is left out on purpose, so finishing today's steps cannot change
 * today's load in the middle of the day. A mission with fewer than seven whole
 * days before today runs at its base load, so a new mission is never judged
 * on a partial week.
 */

import {
  addDays,
  completionDays,
  daysBetween,
  localDay,
  placementMinutes,
  type ScheduleCompletion,
  type ScheduleStep,
} from "./days";

export const ADAPT_WINDOW_DAYS = 7;
export const ADAPT_RAISE_ABOVE = 0.85;
export const ADAPT_RAISE_FACTOR = 1.15;
export const ADAPT_LOWER_BELOW = 0.45;
export const ADAPT_LOWER_FACTOR = 0.8;

export interface RecentCompletionInput {
  /** Today's local date, YYYY-MM-DD. */
  today: string;
  timezone: string | undefined;
  /** The instant the mission began (ISO-8601). Earlier days are not counted. */
  startedAt: string;
  /** The base daily load in minutes. */
  base: number;
  /** The steps on the path, for their estimates. */
  steps: readonly ScheduleStep[];
  completions: readonly ScheduleCompletion[];
}

/**
 * Completed minutes over capacity minutes in the last seven days, or `null`
 * until the mission has seven whole days before today. A completed step that has since been deleted
 * has no estimate left, so it is not counted.
 */
export function recentCompletionRatio(input: RecentCompletionInput): number | null {
  const started = new Date(input.startedAt);
  const startDay = Number.isNaN(started.getTime())
    ? input.today
    : localDay(started, input.timezone);
  // Only a full week counts: a mission with fewer than seven whole days behind
  // it runs at its base load, so one quiet first day cannot cut day two.
  if (daysBetween(startDay, input.today) < ADAPT_WINDOW_DAYS || input.base <= 0) return null;
  const windowStart = addDays(input.today, -ADAPT_WINDOW_DAYS);
  const windowDays = ADAPT_WINDOW_DAYS;

  const minutesById = new Map(
    input.steps.map((step) => [step.id, placementMinutes(step.estimatedMinutes)]),
  );
  let completed = 0;
  for (const [stepId, day] of completionDays(input.completions, input.timezone)) {
    const minutes = minutesById.get(stepId);
    if (minutes === undefined) continue;
    if (day >= windowStart && day < input.today) completed += minutes;
  }
  return completed / (input.base * windowDays);
}

/** The thresholds alone: the load for a ratio, or the base when there is none. */
export function adaptForRatio(base: number, ratio: number | null): number {
  if (ratio === null) return base;
  if (ratio > ADAPT_RAISE_ABOVE) return base * ADAPT_RAISE_FACTOR;
  if (ratio < ADAPT_LOWER_BELOW) return base * ADAPT_LOWER_FACTOR;
  return base;
}

/** Today's load in minutes: the base, adapted to the last seven days. */
export function adaptCapacity(input: RecentCompletionInput): number {
  return adaptForRatio(input.base, recentCompletionRatio(input));
}
