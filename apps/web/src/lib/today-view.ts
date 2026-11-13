/**
 * Small, pure helpers for rendering a `TodayPlan`. No dates are read from a
 * clock: every label is computed from the plan's own local dates.
 */

import type { StoredMissionView, TodayPlan } from "@zandegi/api/client";

type Chapter = StoredMissionView["mission"]["chapters"][number];
type Step = Chapter["steps"][number];

export interface PlacedStep {
  step: Step;
  chapter: Chapter;
  chapterNumber: number;
}

/** Each step on the path by id, with its chapter. */
export function stepsById(mission: StoredMissionView): Map<string, PlacedStep> {
  const placed = new Map<string, PlacedStep>();
  mission.mission.chapters.forEach((chapter, index) => {
    for (const step of chapter.steps)
      placed.set(step.id, { step, chapter, chapterNumber: index + 1 });
  });
  return placed;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "Tomorrow" for the day after `today`, otherwise the weekday, e.g. "Saturday". */
export function dayLabel(date: string, today: string): string {
  const offset = Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / MS_PER_DAY,
  );
  if (offset === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-AU", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

/** The total estimate of some steps, counting only real estimates. */
export function totalMinutes(steps: readonly PlacedStep[]): number {
  return steps.reduce((sum, placed) => sum + Math.max(0, placed.step.estimatedMinutes), 0);
}

/** The steps a plan names, in order, skipping any no longer on the path. */
export function placed(ids: readonly string[], lookup: Map<string, PlacedStep>): PlacedStep[] {
  return ids.flatMap((id) => {
    const found = lookup.get(id);
    return found === undefined ? [] : [found];
  });
}

/** The upcoming days that hold at least one step. */
export function upcomingWithSteps(plan: TodayPlan): TodayPlan["upcoming"] {
  return plan.upcoming.filter((day) => day.stepIds.length > 0);
}
