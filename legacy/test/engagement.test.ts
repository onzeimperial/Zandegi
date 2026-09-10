import { describe, it, expect } from "vitest";
import {
  questsForDay,
  questProgress,
  QUEST_DEFS,
  QUESTS_PER_DAY,
  type QuestStats,
} from "@/server/engagement/quests";
import {
  seasonIndexFor,
  seasonWindow,
  settleDivision,
  promote,
  relegate,
  divisionRank,
  PROMOTE_COUNT,
  RELEGATE_COUNT,
  MIN_SIZE_FOR_RELEGATION,
} from "@/server/engagement/leagues";
import { DIVISIONS } from "@/lib/constants";

const DAY = new Date("2026-06-15T00:00:00Z");

describe("daily quests", () => {
  it("gives the configured number of quests", () => {
    expect(questsForDay("user-1", DAY)).toHaveLength(QUESTS_PER_DAY);
  });

  it("is deterministic for a user and day", () => {
    expect(questsForDay("user-1", DAY)).toEqual(questsForDay("user-1", DAY));
  });

  it("differs between users", () => {
    const a = questsForDay("user-1", DAY).map((q) => q.key + q.target).join();
    const b = questsForDay("user-zzz", DAY).map((q) => q.key + q.target).join();
    expect(a).not.toBe(b);
  });

  it("rotates day to day", () => {
    const next = new Date(DAY.getTime() + 86_400_000);
    const a = questsForDay("user-1", DAY).map((q) => q.key + q.target).join();
    const b = questsForDay("user-1", next).map((q) => q.key + q.target).join();
    expect(a).not.toBe(b);
  });

  it("never repeats a quest within a day", () => {
    for (let i = 0; i < 200; i++) {
      const keys = questsForDay(`u${i}`, DAY).map((q) => q.key);
      expect(new Set(keys).size, `user u${i} got duplicates`).toBe(keys.length);
    }
  });

  it("always includes at least one achievable quest", () => {
    const hardKeys = new Set(QUEST_DEFS.filter((q) => q.hard).map((q) => q.key));
    for (let i = 0; i < 200; i++) {
      const keys = questsForDay(`u${i}`, DAY).map((q) => q.key);
      expect(keys.some((k) => !hardKeys.has(k)), `user u${i} got only hard quests`).toBe(true);
    }
  });

  it("picks targets from the definition's own list", () => {
    for (let i = 0; i < 100; i++) {
      for (const q of questsForDay(`u${i}`, DAY)) {
        const def = QUEST_DEFS.find((d) => d.key === q.key)!;
        expect(def.targets).toContain(q.target);
      }
    }
  });

  it("substitutes the target into the description", () => {
    for (const q of questsForDay("user-1", DAY)) {
      expect(q.description).not.toContain("{n}");
      expect(q.description).toContain(String(q.target));
    }
  });

  it("always offers a reward", () => {
    for (const q of questsForDay("user-1", DAY)) {
      expect(q.rewardCoins + q.rewardXp).toBeGreaterThan(0);
    }
  });
});

describe("questProgress", () => {
  const stats: QuestStats = {
    tasksCompleted: 4,
    xpEarned: 120,
    minutesLogged: 65,
    goalsTouched: 2,
    milestonesCompleted: 1,
    morningTasks: 3,
    highPerformanceTasks: 2,
  };

  it("reads the right field per metric", () => {
    expect(questProgress("tasks_completed", stats)).toBe(4);
    expect(questProgress("xp_earned", stats)).toBe(120);
    expect(questProgress("minutes_logged", stats)).toBe(65);
    expect(questProgress("goals_touched", stats)).toBe(2);
    expect(questProgress("milestones_completed", stats)).toBe(1);
    expect(questProgress("morning_tasks", stats)).toBe(3);
    expect(questProgress("perfect_task", stats)).toBe(2);
  });

  it("covers every metric a definition uses", () => {
    for (const def of QUEST_DEFS) {
      expect(() => questProgress(def.metric, stats)).not.toThrow();
    }
  });
});

describe("league seasons", () => {
  it("advances one index per week", () => {
    const a = seasonIndexFor(new Date("2026-06-15T00:00:00Z"));
    const b = seasonIndexFor(new Date("2026-06-22T00:00:00Z"));
    expect(b).toBe(a + 1);
  });

  it("is stable within a week", () => {
    const a = seasonIndexFor(new Date("2026-06-15T00:00:00Z"));
    const b = seasonIndexFor(new Date("2026-06-19T23:00:00Z"));
    expect(b).toBe(a);
  });

  it("produces contiguous, week-long windows", () => {
    const i = seasonIndexFor(DAY);
    const w = seasonWindow(i);
    const next = seasonWindow(i + 1);
    expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(7 * 86_400_000);
    expect(next.startsAt.getTime()).toBe(w.endsAt.getTime());
  });

  it("starts each season on a Monday UTC", () => {
    for (let i = 2900; i < 2910; i++) {
      expect(seasonWindow(i).startsAt.getUTCDay()).toBe(1);
    }
  });
});

describe("division movement", () => {
  it("cannot promote past the top", () => {
    expect(promote("diamond")).toBe("diamond");
  });

  it("cannot relegate below the bottom", () => {
    expect(relegate("bronze")).toBe("bronze");
  });

  it("moves one step otherwise", () => {
    expect(divisionRank(promote("bronze"))).toBe(divisionRank("bronze") + 1);
    expect(divisionRank(relegate("gold"))).toBe(divisionRank("gold") - 1);
  });
});

describe("settleDivision", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(3, "0")}`, xp: 1000 - i * 10 }));

  it("ranks by XP descending", () => {
    const out = settleDivision("gold", many(20));
    expect(out.map((r) => r.rank)).toEqual(out.map((_, i) => i + 1));
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.xp).toBeGreaterThanOrEqual(out[i]!.xp);
    }
  });

  it("promotes exactly the configured number", () => {
    const out = settleDivision("gold", many(20));
    expect(out.filter((r) => r.outcome === "promoted")).toHaveLength(PROMOTE_COUNT);
  });

  it("relegates exactly the configured number", () => {
    const out = settleDivision("gold", many(20));
    expect(out.filter((r) => r.outcome === "relegated")).toHaveLength(RELEGATE_COUNT);
  });

  it("never relegates out of the bottom division", () => {
    const out = settleDivision("bronze", many(30));
    expect(out.some((r) => r.outcome === "relegated")).toBe(false);
  });

  it("never promotes out of the top division", () => {
    const out = settleDivision("diamond", many(30));
    expect(out.some((r) => r.outcome === "promoted")).toBe(false);
  });

  it("spares small leagues from relegation", () => {
    const out = settleDivision("gold", many(MIN_SIZE_FOR_RELEGATION - 1));
    expect(out.some((r) => r.outcome === "relegated")).toBe(false);
  });

  it("does not promote people who earned nothing", () => {
    const idle = Array.from({ length: 20 }, (_, i) => ({ userId: `u${i}`, xp: 0 }));
    const out = settleDivision("gold", idle);
    expect(out.some((r) => r.outcome === "promoted")).toBe(false);
  });

  it("breaks ties deterministically", () => {
    const tied = [
      { userId: "zeta", xp: 100 },
      { userId: "alpha", xp: 100 },
    ];
    expect(settleDivision("gold", tied)[0]!.userId).toBe("alpha");
    expect(settleDivision("gold", [...tied].reverse())[0]!.userId).toBe("alpha");
  });

  it("assigns a valid next division to everyone", () => {
    const out = settleDivision("gold", many(20));
    for (const r of out) expect(DIVISIONS).toContain(r.nextDivision);
  });

  it("handles an empty division", () => {
    expect(settleDivision("gold", [])).toEqual([]);
  });
});
