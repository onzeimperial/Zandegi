/**
 * Today's plan for each of the principal's missions (spec C, the daily loop).
 *
 * One use case for the Today screen and the daily reminder. It reads the
 * missions and the ledger and hands the arithmetic to `@zandegi/core`'s pure
 * planner. It writes nothing: no ledger event, no stored schedule. A missed day
 * therefore needs no job and has no penalty -- the undone steps are simply
 * still undone, and they lead today (laws 4 and 8).
 *
 * The day boundary is the mission's own zone, then the zone the browser sent,
 * then UTC.
 */

import {
  adaptCapacity,
  baseDailyMinutes,
  isReturningAfterGap,
  localDay,
  planDays,
  type ScheduleCompletion,
  type ScheduleStep,
} from "@zandegi/core";
import {
  GENERATE_MISSION_LIMITS,
  TODAY_PLAN_UPCOMING_DAYS,
  type ProgressView,
  type StoredMissionView,
  type TodayPlan,
} from "../client";
import { isSupportedTimezone } from "../generation/request";
import type { GuestPrincipal } from "../identity/ports";
import { toMissionView } from "../missions/list-missions";
import type { Clock, GeneratedMissionRecord, GenerationPersistencePort } from "../ports";
import { foldProgress, readEvents } from "../progress/fold";
import type { ProgressLedgerPort } from "../progress/ledger";
import { storeCall } from "./store-call";

/** A zone this runtime knows, or `undefined`. Untrusted input is fine here. */
export function validTimezone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > GENERATE_MISSION_LIMITS.maxTimezoneLength) {
    return undefined;
  }
  return isSupportedTimezone(value) ? value : undefined;
}

/** The zone a mission's days follow: its own, then the browser's, then UTC (`undefined`). */
export function planTimezone(
  record: Pick<GeneratedMissionRecord, "goalContext">,
  browserTimezone: unknown,
): string | undefined {
  return validTimezone(record.goalContext?.timezone) ?? validTimezone(browserTimezone);
}

export interface BuildTodayPlanInput {
  /** The mission, upcast to stable ids. */
  view: StoredMissionView;
  /** The stored record, for its goal context. Never sent to a client. */
  record: Pick<GeneratedMissionRecord, "goalContext">;
  progress: ProgressView;
  now: Date;
  browserTimezone?: unknown;
}

/** Pure given its inputs: the plan for one mission at `now`. */
export function buildTodayPlan(input: BuildTodayPlanInput): TodayPlan {
  const { view, progress, now } = input;
  const timezone = planTimezone(input.record, input.browserTimezone);
  const today = localDay(now, timezone);

  const steps: ScheduleStep[] = view.mission.chapters.flatMap((chapter) =>
    chapter.steps.map((step) => ({ id: step.id, estimatedMinutes: step.estimatedMinutes })),
  );
  const completions: ScheduleCompletion[] = progress.completions
    .filter((completion) => completion.missionId === view.missionId)
    .map((completion) => ({ stepId: completion.stepId, at: completion.recordedAt }));

  const capacity = adaptCapacity({
    today,
    timezone,
    startedAt: view.generatedAt,
    base: baseDailyMinutes(input.record.goalContext?.weeklyTimeBudgetMinutes),
    steps,
    completions,
  });
  const plan = planDays({
    today,
    timezone,
    steps,
    completions,
    capacity,
    horizonDays: 1 + TODAY_PLAN_UPCOMING_DAYS,
  });

  const [first, ...rest] = plan.days;
  const todayStepIds = first?.stepIds ?? [];
  const done = new Set(plan.doneTodayStepIds);
  const completed = new Set(completions.map((completion) => completion.stepId));
  const finished = steps.every((step) => completed.has(step.id));

  return {
    missionId: view.missionId,
    today,
    todayStepIds,
    doneTodayStepIds: plan.doneTodayStepIds,
    upcoming: rest.map((day) => ({ date: day.day, stepIds: day.stepIds })),
    laterStepCount: plan.laterStepIds.length,
    doneForToday: !finished && todayStepIds.length > 0 && todayStepIds.every((id) => done.has(id)),
    finished,
    returningAfterGap: isReturningAfterGap({
      today,
      timezone,
      startedAt: view.generatedAt,
      completions,
      hasUndoneSteps: !finished,
    }),
    dailyMinutes: Math.round(capacity),
  };
}

export interface PlanTodayInput {
  /** The resolved owner. Planning never mints one. */
  principal: GuestPrincipal;
  /** Untrusted: the zone the browser reported. Used only when a mission has none. */
  browserTimezone?: unknown;
}

export interface PlanTodayPorts {
  persistence: GenerationPersistencePort;
  ledger: ProgressLedgerPort;
  clock: Clock;
}

export interface PlanTodayResult {
  /** The principal's missions, newest first, as `listMissions` returns them. */
  missions: StoredMissionView[];
  progress: ProgressView;
  /** Each mission's plan, by mission id. Absent for a mission that could not be planned. */
  plans: Record<string, TodayPlan>;
}

export async function planToday(
  input: PlanTodayInput,
  ports: PlanTodayPorts,
): Promise<PlanTodayResult> {
  const ownerId = input.principal.id;
  const [records, entries] = await Promise.all([
    storeCall(() => ports.persistence.listForOwner(ownerId)),
    storeCall(() => ports.ledger.read(ownerId)),
  ]);
  const progress = foldProgress(readEvents(entries));
  const now = ports.clock.now();
  const missions: StoredMissionView[] = [];
  const plans: Record<string, TodayPlan> = {};
  for (const record of records) {
    const view = toMissionView(record);
    missions.push(view);
    try {
      plans[view.missionId] = buildTodayPlan({
        view,
        record,
        progress,
        now,
        browserTimezone: input.browserTimezone,
      });
    } catch (error) {
      // One malformed mission must not take every plan down: it simply has no
      // plan. The error class only: a message could quote step text.
      console.error(
        "[plan-today]",
        JSON.stringify({
          outcome: "plan-failed",
          error: error instanceof Error ? error.name : "non-error",
        }),
      );
    }
  }
  return { missions, progress, plans };
}
