import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS, ACHIEVEMENT_BY_KEY, type AchievementStats } from "@/server/achievements/definitions";

const zeroStats: AchievementStats = {
  totalXp: 0,
  level: 1,
  streakCurrent: 0,
  streakLongest: 0,
  tasksCompleted: 0,
  tasksCompletedToday: 0,
  goalsActive: 0,
  goalsCompleted: 0,
  milestonesCompleted: 0,
  skillsMastered: 0,
  distinctGoalCategories: 0,
  friends: 0,
  challengesWon: 0,
  minutesLogged: 0,
  perfectWeeks: 0,
  earlyBirdCompletions: 0,
  nightOwlCompletions: 0,
};

describe("achievement catalogue", () => {
  it("has unique keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every check returns a number in 0..100 for any stats", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.check(zeroStats)).toBeGreaterThanOrEqual(0);
      expect(a.check(zeroStats)).toBeLessThanOrEqual(100);
      const maxed: AchievementStats = {
        ...zeroStats,
        totalXp: 1e9,
        level: 999,
        streakLongest: 999,
        tasksCompleted: 1e6,
        milestonesCompleted: 1e6,
        skillsMastered: 999,
        distinctGoalCategories: 50,
        friends: 999,
        challengesWon: 999,
        minutesLogged: 1e6,
        goalsCompleted: 5,
        goalsActive: 20,
        earlyBirdCompletions: 999,
        nightOwlCompletions: 999,
      };
      expect(a.check(maxed)).toBe(100);
    }
  });

  it("nothing is unlocked from a zeroed profile", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.check(zeroStats)).toBeLessThan(100);
    }
  });

  it("streak_7 unlocks exactly at a 7-day longest streak", () => {
    const def = ACHIEVEMENT_BY_KEY.get("streak_7")!;
    expect(def.check({ ...zeroStats, streakLongest: 6 })).toBeLessThan(100);
    expect(def.check({ ...zeroStats, streakLongest: 7 })).toBe(100);
  });

  it("first_quest unlocks after a single completed task", () => {
    const def = ACHIEVEMENT_BY_KEY.get("first_quest")!;
    expect(def.check({ ...zeroStats, tasksCompleted: 1 })).toBe(100);
  });

  it("polymath needs 4 distinct goal categories", () => {
    const def = ACHIEVEMENT_BY_KEY.get("polymath")!;
    expect(def.check({ ...zeroStats, distinctGoalCategories: 3 })).toBe(75);
    expect(def.check({ ...zeroStats, distinctGoalCategories: 4 })).toBe(100);
  });

  it("every achievement has a positive XP reward and a known tier", () => {
    const tiers = new Set(["bronze", "silver", "gold", "platinum"]);
    for (const a of ACHIEVEMENTS) {
      expect(a.xpReward).toBeGreaterThan(0);
      expect(tiers.has(a.tier)).toBe(true);
    }
  });
});
