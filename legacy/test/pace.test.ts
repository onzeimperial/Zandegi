import { describe, it, expect } from "vitest";
import { projectPace } from "@/server/planning/pace";

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

describe("projectPace", () => {
  it("returns no_deadline when there's no timeline or target date", () => {
    const p = projectPace({
      progressPct: 20,
      startedAt: daysAgo(10),
      timelineWeeks: null,
      targetDate: null,
      activeDaysLast14: 7,
      plannedDaysPerWeek: 5,
    });
    expect(p.status).toBe("no_deadline");
  });

  it("flags 'behind' when progress lags the schedule", () => {
    const p = projectPace({
      progressPct: 5,
      startedAt: daysAgo(30),
      timelineWeeks: 8, // 56 days total, ~54% elapsed
      targetDate: null,
      activeDaysLast14: 3,
      plannedDaysPerWeek: 5,
    });
    expect(p.expectedProgressPct).toBeGreaterThan(40);
    expect(p.status).toBe("behind");
    expect(p.deltaPct).toBeLessThan(0);
  });

  it("flags 'ahead' when progress outpaces the schedule", () => {
    const p = projectPace({
      progressPct: 70,
      startedAt: daysAgo(10),
      timelineWeeks: 12,
      targetDate: null,
      activeDaysLast14: 12,
      plannedDaysPerWeek: 5,
    });
    expect(p.status).toBe("ahead");
    expect(p.deltaPct).toBeGreaterThan(0);
  });

  it("flags 'stalled' when there's been no progress for over a week", () => {
    const p = projectPace({
      progressPct: 0,
      startedAt: daysAgo(20),
      timelineWeeks: 10,
      targetDate: null,
      activeDaysLast14: 0,
      plannedDaysPerWeek: 5,
    });
    expect(p.status).toBe("stalled");
    expect(p.projectedDoneDate).toBeNull();
  });

  it("projects a completion date from current velocity", () => {
    const p = projectPace({
      progressPct: 25,
      startedAt: daysAgo(25),
      timelineWeeks: 20,
      targetDate: null,
      activeDaysLast14: 10,
      plannedDaysPerWeek: 5,
    });
    expect(p.projectedDoneDate).toBeInstanceOf(Date);
    expect(p.projectedDoneDate!.getTime()).toBeGreaterThan(Date.now());
  });

  it("computes adherence as active vs planned days over 2 weeks", () => {
    const p = projectPace({
      progressPct: 40,
      startedAt: daysAgo(14),
      timelineWeeks: 8,
      targetDate: null,
      activeDaysLast14: 5,
      plannedDaysPerWeek: 5, // planned 10 over 2 weeks
    });
    expect(p.adherence).toBeCloseTo(0.5, 5);
  });
});
