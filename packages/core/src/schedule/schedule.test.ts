import { describe, expect, it } from "vitest";
import {
  ADAPT_LOWER_FACTOR,
  ADAPT_RAISE_FACTOR,
  DEFAULT_DAILY_MINUTES,
  UNESTIMATED_STEP_MINUTES,
  adaptCapacity,
  adaptForRatio,
  addDays,
  baseDailyMinutes,
  daysBetween,
  isReturningAfterGap,
  localDay,
  planDays,
  recentCompletionRatio,
  type ScheduleCompletion,
  type ScheduleStep,
} from "./index";

const SYDNEY = "Australia/Sydney";
const steps = (count: number, minutes = 40): ScheduleStep[] =>
  Array.from({ length: count }, (_, i) => ({ id: `0:${i}`, estimatedMinutes: minutes }));

describe("local days", () => {
  it("puts 23:30 and 00:30 in Sydney on different days, though the UTC date is the same", () => {
    // AEDT is UTC+11 in November.
    const lateEvening = new Date("2026-11-12T12:30:00.000Z"); // 23:30 on the 12th
    const pastMidnight = new Date("2026-11-12T13:30:00.000Z"); // 00:30 on the 13th
    expect(lateEvening.toISOString().slice(0, 10)).toBe(pastMidnight.toISOString().slice(0, 10));
    expect(localDay(lateEvening, SYDNEY)).toBe("2026-11-12");
    expect(localDay(pastMidnight, SYDNEY)).toBe("2026-11-13");
  });

  it("falls back to UTC with no zone, like the pipeline's localDate", () => {
    expect(localDay(new Date("2026-11-12T13:30:00.000Z"), undefined)).toBe("2026-11-12");
  });

  it("finds midnight on both sides of a daylight-saving change", () => {
    // Sydney moves from AEST (+10) to AEDT (+11) at 02:00 on 4 October 2026.
    expect(localDay(new Date("2026-10-03T13:59:00.000Z"), SYDNEY)).toBe("2026-10-03");
    expect(localDay(new Date("2026-10-03T14:00:00.000Z"), SYDNEY)).toBe("2026-10-04");
    // The day after the change, midnight is an hour earlier in UTC.
    expect(localDay(new Date("2026-10-04T12:59:00.000Z"), SYDNEY)).toBe("2026-10-04");
    expect(localDay(new Date("2026-10-04T13:00:00.000Z"), SYDNEY)).toBe("2026-10-05");
  });

  it("counts calendar days, so a 23-hour day is still one day", () => {
    expect(addDays("2026-10-03", 1)).toBe("2026-10-04");
    expect(addDays("2026-10-04", 1)).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-01")).toBe(-7);
  });

  it("refuses a day that is not YYYY-MM-DD", () => {
    expect(() => addDays("12/11/2026", 1)).toThrow(RangeError);
  });

  it("spreads the weekly budget over seven days, or holds 30 minutes with none", () => {
    expect(baseDailyMinutes(700)).toBe(100);
    expect(baseDailyMinutes(undefined)).toBe(DEFAULT_DAILY_MINUTES);
    expect(baseDailyMinutes(0)).toBe(DEFAULT_DAILY_MINUTES);
    expect(baseDailyMinutes(Number.NaN)).toBe(DEFAULT_DAILY_MINUTES);
  });
});

describe("placing steps on days", () => {
  const today = "2026-11-12";

  it("spreads five 40-minute steps over a 600-minute week, two a day", () => {
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: steps(5),
      completions: [],
      capacity: baseDailyMinutes(600), // about 86
      horizonDays: 4,
    });
    expect(plan.days).toEqual([
      { day: "2026-11-12", stepIds: ["0:0", "0:1"] },
      { day: "2026-11-13", stepIds: ["0:2", "0:3"] },
      { day: "2026-11-14", stepIds: ["0:4"] },
      { day: "2026-11-15", stepIds: [] },
    ]);
    expect(plan.laterStepIds).toEqual([]);
  });

  it("keeps today stable once today's steps are done, and pulls nothing new in", () => {
    const capacity = baseDailyMinutes(600);
    const completions: ScheduleCompletion[] = [
      { stepId: "0:0", at: "2026-11-11T22:00:00.000Z" }, // 09:00 on the 12th
      { stepId: "0:1", at: "2026-11-12T01:00:00.000Z" }, // 12:00 on the 12th
    ];
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: steps(5),
      completions,
      capacity,
      horizonDays: 2,
    });
    expect(plan.days[0]).toEqual({ day: today, stepIds: ["0:0", "0:1"] });
    expect(plan.doneTodayStepIds).toEqual(["0:0", "0:1"]);
    expect(plan.days[1]).toEqual({ day: "2026-11-13", stepIds: ["0:2", "0:3"] });
  });

  it("keeps the same list after one of today's steps is done", () => {
    const base = { today, timezone: SYDNEY, steps: steps(5), capacity: 86, horizonDays: 1 };
    const before = planDays({ ...base, completions: [] });
    const after = planDays({
      ...base,
      completions: [{ stepId: "0:0", at: "2026-11-11T22:00:00.000Z" }],
    });
    expect(after.days[0]!.stepIds).toEqual(before.days[0]!.stepIds);
  });

  it("does not count yesterday's completions toward today", () => {
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: steps(5),
      completions: [{ stepId: "0:0", at: "2026-11-11T05:00:00.000Z" }], // the 11th
      capacity: 86,
      horizonDays: 1,
    });
    expect(plan.days[0]!.stepIds).toEqual(["0:1", "0:2"]);
    expect(plan.doneTodayStepIds).toEqual([]);
  });

  it("lets yesterday's undone steps lead today, unchanged", () => {
    const input = { timezone: SYDNEY, steps: steps(5), completions: [], capacity: 86 };
    const yesterday = planDays({ ...input, today: "2026-11-11", horizonDays: 1 });
    const todayPlan = planDays({ ...input, today, horizonDays: 1 });
    expect(todayPlan.days[0]!.stepIds).toEqual(yesterday.days[0]!.stepIds);
  });

  it("gives a 180-minute step a 60-minute day on its own", () => {
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: [
        { id: "0:0", estimatedMinutes: 180 },
        { id: "0:1", estimatedMinutes: 20 },
      ],
      completions: [],
      capacity: 60,
      horizonDays: 2,
    });
    expect(plan.days[0]!.stepIds).toEqual(["0:0"]);
    expect(plan.days[1]!.stepIds).toEqual(["0:1"]);
  });

  it("holds 30 minutes a day when there is no budget", () => {
    const plan = planDays({
      today,
      timezone: undefined,
      steps: steps(3, 15),
      completions: [],
      capacity: baseDailyMinutes(undefined),
      horizonDays: 2,
    });
    expect(plan.days[0]!.stepIds).toEqual(["0:0", "0:1"]);
    expect(plan.days[1]!.stepIds).toEqual(["0:2"]);
  });

  it("keeps the path's order, including a person's reorder", () => {
    const reordered: ScheduleStep[] = [
      { id: "0:2", estimatedMinutes: 40 },
      { id: "own-1", estimatedMinutes: 0 },
      { id: "0:0", estimatedMinutes: 40 },
    ];
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: reordered,
      completions: [],
      capacity: 200,
      horizonDays: 1,
    });
    expect(plan.days[0]!.stepIds).toEqual(["0:2", "own-1", "0:0"]);
  });

  it("places a step with no estimate at a nominal size, without resizing it", () => {
    const written: ScheduleStep[] = [
      { id: "own-1", estimatedMinutes: 0 },
      { id: "own-2", estimatedMinutes: 0 },
    ];
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: written,
      completions: [],
      capacity: UNESTIMATED_STEP_MINUTES,
      horizonDays: 2,
    });
    expect(plan.days.map((day) => day.stepIds)).toEqual([["own-1"], ["own-2"]]);
    expect(written[0]!.estimatedMinutes).toBe(0);
  });

  it("lists today's steps in path order, done or not", () => {
    // After a reorder, a step done today can sit after an undone one.
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: steps(3),
      completions: [{ stepId: "0:1", at: "2026-11-11T22:00:00.000Z" }], // 09:00 on the 12th
      capacity: 200,
      horizonDays: 1,
    });
    expect(plan.days[0]!.stepIds).toEqual(["0:0", "0:1", "0:2"]);
    expect(plan.doneTodayStepIds).toEqual(["0:1"]);
  });

  it("lists what falls after the horizon", () => {
    const plan = planDays({
      today,
      timezone: SYDNEY,
      steps: steps(6),
      completions: [],
      capacity: 40,
      horizonDays: 4,
    });
    expect(plan.laterStepIds).toEqual(["0:4", "0:5"]);
  });

  it("places by the zone's day across a daylight-saving change", () => {
    // 00:30 on 5 October in Sydney is 13:30 UTC on the 4th, after the change.
    const plan = planDays({
      today: "2026-10-05",
      timezone: SYDNEY,
      steps: steps(3),
      completions: [{ stepId: "0:0", at: "2026-10-04T13:30:00.000Z" }],
      capacity: 40,
      horizonDays: 1,
    });
    expect(plan.doneTodayStepIds).toEqual(["0:0"]);
    expect(plan.days[0]!.stepIds).toEqual(["0:0"]);
  });
});

describe("adapting the daily load", () => {
  const today = "2026-11-12";
  const base = 60;
  const started = "2026-11-01T00:00:00.000Z";
  // Ten 60-minute steps; completions spread over the last seven days.
  const path = steps(10, 60);
  const doneOnDays = (count: number): ScheduleCompletion[] =>
    Array.from({ length: count }, (_, i) => ({
      stepId: `0:${i}`,
      at: `2026-11-${String(5 + i).padStart(2, "0")}T02:00:00.000Z`,
    }));

  it("adds 15% above 0.85 of capacity completed", () => {
    const input = {
      today,
      timezone: SYDNEY,
      startedAt: started,
      base,
      steps: path,
      completions: doneOnDays(7),
    };
    expect(recentCompletionRatio(input)).toBe(1);
    expect(adaptCapacity(input)).toBeCloseTo(base * ADAPT_RAISE_FACTOR);
  });

  it("removes 20% below 0.45", () => {
    const input = {
      today,
      timezone: SYDNEY,
      startedAt: started,
      base,
      steps: path,
      completions: doneOnDays(2),
    };
    expect(recentCompletionRatio(input)).toBeCloseTo(2 / 7);
    expect(adaptCapacity(input)).toBeCloseTo(base * ADAPT_LOWER_FACTOR);
  });

  it("leaves the base alone in between", () => {
    expect(adaptForRatio(base, 0.6)).toBe(base);
    expect(adaptForRatio(base, 0.85)).toBe(base);
    expect(adaptForRatio(base, 0.45)).toBe(base);
  });

  it("does not count today, so finishing today's steps cannot change today", () => {
    const input = {
      today,
      timezone: SYDNEY,
      startedAt: started,
      base,
      steps: path,
      completions: [{ stepId: "0:0", at: "2026-11-12T02:00:00.000Z" }],
    };
    expect(recentCompletionRatio(input)).toBe(0);
  });

  it("starts a new mission at its base, with no window yet", () => {
    const input = {
      today,
      timezone: SYDNEY,
      startedAt: "2026-11-12T01:00:00.000Z",
      base,
      steps: path,
      completions: [],
    };
    expect(recentCompletionRatio(input)).toBeNull();
    expect(adaptCapacity(input)).toBe(base);
  });

  it("keeps the base until the mission has seven whole days before today", () => {
    // Began yesterday and did nothing: day two is not cut.
    const yesterday = {
      today,
      timezone: SYDNEY,
      startedAt: "2026-11-10T22:00:00.000Z", // 09:00 on the 11th
      base,
      steps: path,
      completions: [],
    };
    expect(recentCompletionRatio(yesterday)).toBeNull();
    expect(adaptCapacity(yesterday)).toBe(base);
    // Six whole days is still not a week.
    const sixDays = { ...yesterday, startedAt: "2026-11-05T22:00:00.000Z" }; // the 6th
    expect(recentCompletionRatio(sixDays)).toBeNull();
    // Seven whole days is: nothing done in them lowers the load.
    const week = { ...yesterday, startedAt: "2026-11-04T22:00:00.000Z" }; // the 5th
    expect(recentCompletionRatio(week)).toBe(0);
    expect(adaptCapacity(week)).toBeCloseTo(base * ADAPT_LOWER_FACTOR);
  });

  it("ignores completions older than seven days and of deleted steps", () => {
    const input = {
      today,
      timezone: SYDNEY,
      startedAt: "2026-10-01T00:00:00.000Z",
      base,
      steps: path,
      completions: [
        { stepId: "0:0", at: "2026-11-01T02:00:00.000Z" },
        { stepId: "gone", at: "2026-11-10T02:00:00.000Z" },
      ],
    };
    expect(recentCompletionRatio(input)).toBe(0);
  });
});

describe("returning after a gap", () => {
  const today = "2026-11-12";
  const startedAt = "2026-11-01T00:00:00.000Z";

  it("greets the person when nothing was completed yesterday", () => {
    expect(
      isReturningAfterGap({
        today,
        timezone: SYDNEY,
        startedAt,
        completions: [{ stepId: "0:0", at: "2026-11-09T02:00:00.000Z" }],
        hasUndoneSteps: true,
      }),
    ).toBe(true);
  });

  it("stays quiet after a step yesterday, or once a step is done today", () => {
    const base = { today, timezone: SYDNEY, startedAt, hasUndoneSteps: true };
    expect(
      isReturningAfterGap({
        ...base,
        completions: [{ stepId: "0:0", at: "2026-11-11T02:00:00.000Z" }],
      }),
    ).toBe(false);
    expect(
      isReturningAfterGap({
        ...base,
        completions: [{ stepId: "0:0", at: "2026-11-12T02:00:00.000Z" }],
      }),
    ).toBe(false);
  });

  it("stays quiet the morning after a mission begins", () => {
    expect(
      isReturningAfterGap({
        today,
        timezone: SYDNEY,
        startedAt: "2026-11-10T22:00:00.000Z", // 09:00 on the 11th
        completions: [],
        hasUndoneSteps: true,
      }),
    ).toBe(false);
  });

  it("stays quiet on the day a mission begins, and once it is finished", () => {
    expect(
      isReturningAfterGap({
        today,
        timezone: SYDNEY,
        startedAt: "2026-11-11T22:00:00.000Z", // 09:00 on the 12th
        completions: [],
        hasUndoneSteps: true,
      }),
    ).toBe(false);
    expect(
      isReturningAfterGap({
        today,
        timezone: SYDNEY,
        startedAt,
        completions: [],
        hasUndoneSteps: false,
      }),
    ).toBe(false);
  });

  it("uses the zone's day: 23:30 yesterday in Sydney is still yesterday", () => {
    expect(
      isReturningAfterGap({
        today,
        timezone: SYDNEY,
        startedAt,
        completions: [{ stepId: "0:0", at: "2026-11-11T12:30:00.000Z" }], // 23:30 on the 11th
        hasUndoneSteps: true,
      }),
    ).toBe(false);
  });
});
