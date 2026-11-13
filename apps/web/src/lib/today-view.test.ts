import { describe, expect, it } from "vitest";
import type { StoredMissionView, TodayPlan } from "@zandegi/api/client";
import { timezoneCookie, timezoneFromCookieHeader } from "./timezone";
import { dayLabel, placed, stepsById, totalMinutes, upcomingWithSteps } from "./today-view";

const step = (id: string, estimatedMinutes: number) => ({
  id,
  index: 0,
  title: `Step ${id}`,
  estimatedMinutes,
  verification: "SELF" as const,
  guide: { approach: "", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

const mission: StoredMissionView = {
  missionId: "m-1",
  generatedAt: "2026-11-12T00:00:00.000Z",
  pursuitSlug: "x",
  safetyClass: "NORMAL",
  version: 0,
  mission: {
    title: "T",
    goalType: "PROJECT",
    primaryDomain: "Mind",
    chapters: [
      { id: "0", index: 0, title: "A", exitCondition: "", steps: [step("0:0", 40)] },
      { id: "1", index: 1, title: "B", exitCondition: "", steps: [step("own-1", 0)] },
    ],
  },
};

describe("today view helpers", () => {
  it("labels the next day Tomorrow and later days by weekday", () => {
    expect(dayLabel("2026-11-13", "2026-11-12")).toBe("Tomorrow");
    expect(dayLabel("2026-11-14", "2026-11-12")).toBe("Saturday");
  });

  it("finds steps by id with their chapter, skipping ids no longer on the path", () => {
    const lookup = stepsById(mission);
    const found = placed(["own-1", "gone", "0:0"], lookup);
    expect(found.map((entry) => [entry.step.id, entry.chapterNumber])).toEqual([
      ["own-1", 2],
      ["0:0", 1],
    ]);
    // A step with no estimate adds nothing: no time is invented for it.
    expect(totalMinutes(found)).toBe(40);
  });

  it("drops empty upcoming days", () => {
    const plan = {
      upcoming: [
        { date: "2026-11-13", stepIds: ["0:0"] },
        { date: "2026-11-14", stepIds: [] },
      ],
    } as unknown as TodayPlan;
    expect(upcomingWithSteps(plan)).toEqual([{ date: "2026-11-13", stepIds: ["0:0"] }]);
  });
});

describe("the timezone cookie", () => {
  it("round-trips a zone, and reads nothing from a header without one", () => {
    const cookie = timezoneCookie("America/Argentina/Buenos_Aires", true);
    expect(cookie).toContain("Secure");
    const pair = cookie.split(";", 1)[0]!;
    expect(timezoneFromCookieHeader(`a=1; ${pair}; b=2`)).toBe("America/Argentina/Buenos_Aires");
    expect(timezoneFromCookieHeader("a=1")).toBeUndefined();
    expect(timezoneFromCookieHeader(null)).toBeUndefined();
    expect(timezoneFromCookieHeader("zandegi_tz=%E0%A4%A")).toBeUndefined();
    expect(timezoneCookie("UTC", false)).not.toContain("Secure");
  });
});
