/**
 * Placing undone steps on local days (Story 3.1, simplified).
 *
 * The schedule is derived on every read and never stored, so a missed day
 * needs no job: whatever was not done is simply still undone, and it leads
 * the next day the person looks. No penalty, no "missed" state (law 8).
 *
 * The rule, for today:
 *   1. Steps completed earlier today fill the day first, so finishing today's
 *      steps never pulls tomorrow's in.
 *   2. Undone steps follow in path order until the next one would overflow.
 *   3. A day always gets at least one step, even one longer than the day.
 * Later days repeat the rule with nothing completed yet.
 */

import {
  addDays,
  completionDays,
  localDay,
  placementMinutes,
  type ScheduleCompletion,
  type ScheduleStep,
} from "./days";

export interface PlanDaysInput {
  /** Today's local date, YYYY-MM-DD. */
  today: string;
  timezone: string | undefined;
  /** Every step on the path, done or not, in path order. */
  steps: readonly ScheduleStep[];
  completions: readonly ScheduleCompletion[];
  /** Minutes each day can hold. */
  capacity: number;
  /** How many days to plan, today included. */
  horizonDays: number;
}

export interface PlannedDay {
  /** Local date, YYYY-MM-DD. */
  day: string;
  /** In path order. Today's list includes the steps already completed today. */
  stepIds: string[];
}

export interface DayPlan {
  days: PlannedDay[];
  /** The steps on today's list that are already completed today. */
  doneTodayStepIds: string[];
  /** Undone steps that fall after the last planned day. */
  laterStepIds: string[];
}

/** Rounding slack, so 2 x 42.857 still fits a 85.714 minute day. */
const EPSILON = 1e-9;

export function planDays(input: PlanDaysInput): DayPlan {
  const doneOn = completionDays(input.completions, input.timezone);
  const doneToday = input.steps.filter((step) => doneOn.get(step.id) === input.today);
  const undone = input.steps.filter((step) => !doneOn.has(step.id));

  const position = new Map(input.steps.map((step, index) => [step.id, index]));
  const days: PlannedDay[] = [];
  let next = 0;
  for (let offset = 0; offset < Math.max(0, input.horizonDays); offset++) {
    const bucket = offset === 0 ? doneToday.map((step) => step.id) : [];
    let used =
      offset === 0
        ? doneToday.reduce((sum, step) => sum + placementMinutes(step.estimatedMinutes), 0)
        : 0;
    while (next < undone.length) {
      const step = undone[next]!;
      const minutes = placementMinutes(step.estimatedMinutes);
      if (bucket.length > 0 && used + minutes > input.capacity + EPSILON) break;
      bucket.push(step.id);
      used += minutes;
      next += 1;
    }
    // Today mixes done and undone steps; both keep their place on the path.
    const ordered =
      offset === 0 ? bucket.sort((a, b) => position.get(a)! - position.get(b)!) : bucket;
    days.push({ day: addDays(input.today, offset), stepIds: ordered });
  }

  return {
    days,
    doneTodayStepIds: doneToday.map((step) => step.id),
    laterStepIds: undone.slice(next).map((step) => step.id),
  };
}

export interface ReturningInput {
  today: string;
  timezone: string | undefined;
  /** The instant the mission began (ISO-8601). */
  startedAt: string;
  /** Every completion on the mission, including steps since deleted. */
  completions: readonly ScheduleCompletion[];
  /** Whether any step is still undone. A finished mission has nothing to return to. */
  hasUndoneSteps: boolean;
}

/**
 * Whether to greet the person back: the mission began before yesterday,
 * nothing was completed yesterday, and nothing has been completed today yet. The greeting goes once they complete a step today. Nothing is
 * counted or shown about the gap itself (law 8).
 */
export function isReturningAfterGap(input: ReturningInput): boolean {
  if (!input.hasUndoneSteps) return false;
  const started = new Date(input.startedAt);
  if (Number.isNaN(started.getTime())) return false;
  const yesterday = addDays(input.today, -1);
  // Begun yesterday or today: there is no gap to come back from yet.
  if (localDay(started, input.timezone) >= yesterday) return false;
  for (const day of completionDays(input.completions, input.timezone).values()) {
    if (day === yesterday || day === input.today) return false;
  }
  return true;
}
