import { differenceInCalendarDays } from "date-fns";
import { clamp } from "@/lib/utils";

/**
 * Pure pace projection maths. No IO — unit tested (test/planning.test.ts).
 */

export interface PaceInput {
  progressPct: number; // 0..100 now
  startedAt: Date;
  now?: Date;
  timelineWeeks: number | null;
  targetDate: Date | null;
  activeDaysLast14: number;
  plannedDaysPerWeek: number;
}

export interface PaceProjection {
  scheduleElapsed: number;
  expectedProgressPct: number;
  deltaPct: number;
  projectedDoneDate: Date | null;
  status: "ahead" | "on_track" | "behind" | "stalled" | "no_deadline";
  adherence: number;
}

export function projectPace(input: PaceInput): PaceProjection {
  const now = input.now ?? new Date();
  const elapsedDays = Math.max(0, differenceInCalendarDays(now, input.startedAt));
  const adherence =
    input.plannedDaysPerWeek > 0 ? input.activeDaysLast14 / (input.plannedDaysPerWeek * 2) : 0;

  let totalDays: number | null = null;
  if (input.targetDate) totalDays = Math.max(1, differenceInCalendarDays(input.targetDate, input.startedAt));
  else if (input.timelineWeeks) totalDays = input.timelineWeeks * 7;

  if (!totalDays) {
    return {
      scheduleElapsed: 0,
      expectedProgressPct: 0,
      deltaPct: 0,
      projectedDoneDate: null,
      status: "no_deadline",
      adherence,
    };
  }

  const scheduleElapsed = elapsedDays / totalDays;
  const expectedProgressPct = clamp(scheduleElapsed * 100, 0, 100);
  const deltaPct = input.progressPct - expectedProgressPct;

  const velocityPerDay = elapsedDays > 0 ? input.progressPct / elapsedDays : 0;
  const remaining = 100 - input.progressPct;
  const projectedDoneDate =
    velocityPerDay > 0.01 ? new Date(now.getTime() + (remaining / velocityPerDay) * 864e5) : null;

  let status: PaceProjection["status"];
  if (velocityPerDay <= 0.01 && elapsedDays > 7) status = "stalled";
  else if (deltaPct > 8) status = "ahead";
  else if (deltaPct < -12) status = "behind";
  else status = "on_track";

  return { scheduleElapsed, expectedProgressPct, deltaPct, projectedDoneDate, status, adherence };
}
