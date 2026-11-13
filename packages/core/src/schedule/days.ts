/**
 * Local calendar days, and the minutes a day can hold.
 *
 * Pure: nothing here reads a clock. "Now" and the zone are always passed in, so
 * the same inputs give the same day on any machine (CLAUDE.md section 4).
 */

/** Minutes a day holds when the person never said how much time they have. */
export const DEFAULT_DAILY_MINUTES = 30;

/**
 * The size used to place a step that has no estimate, such as one the person
 * wrote. It only decides which day the step lands on. The step itself, and its
 * shown estimate, are never changed.
 */
export const UNESTIMATED_STEP_MINUTES = 30;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The calendar date (YYYY-MM-DD) at `instant` in `timezone`, or in UTC when the
 * zone is unknown. The same rule as the generation pipeline's `localDate`.
 */
export function localDay(instant: Date, timezone: string | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function dayStartMs(day: string): number {
  if (!DAY_PATTERN.test(day)) throw new RangeError("day is not YYYY-MM-DD");
  return Date.parse(`${day}T00:00:00.000Z`);
}

/**
 * The calendar day `count` days after `day`. Calendar arithmetic, so a day with
 * a daylight-saving change is still exactly one day.
 */
export function addDays(day: string, count: number): string {
  return new Date(dayStartMs(day) + count * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayStartMs(to) - dayStartMs(from)) / MS_PER_DAY);
}

/** The base daily load: the weekly budget spread over seven days, or 30 minutes. */
export function baseDailyMinutes(weeklyBudgetMinutes: number | undefined): number {
  if (
    weeklyBudgetMinutes === undefined ||
    !Number.isFinite(weeklyBudgetMinutes) ||
    weeklyBudgetMinutes <= 0
  ) {
    return DEFAULT_DAILY_MINUTES;
  }
  return weeklyBudgetMinutes / 7;
}

/** The minutes a step takes up when placing it on a day. */
export function placementMinutes(estimatedMinutes: number): number {
  return Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
    ? estimatedMinutes
    : UNESTIMATED_STEP_MINUTES;
}

/** A step as the planner sees it: its stable id and its estimate. Path order matters. */
export interface ScheduleStep {
  id: string;
  estimatedMinutes: number;
}

/** A recorded completion: which step, and the instant it was recorded (ISO-8601). */
export interface ScheduleCompletion {
  stepId: string;
  at: string;
}

/**
 * Each completed step's local day. A step completed twice keeps its first
 * day; the ledger pays once, so this only matters for malformed input.
 */
export function completionDays(
  completions: readonly ScheduleCompletion[],
  timezone: string | undefined,
): Map<string, string> {
  const days = new Map<string, string>();
  for (const completion of completions) {
    const at = new Date(completion.at);
    if (Number.isNaN(at.getTime()) || days.has(completion.stepId)) continue;
    days.set(completion.stepId, localDay(at, timezone));
  }
  return days;
}
