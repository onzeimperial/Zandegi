import { describe, it, expect } from "vitest";
import {
  coinsForTask,
  coinsForMilestone,
  coinsForGoalCompletion,
  coinsForAchievement,
  coinsForStreak,
  coinsForLevelUp,
  goalScaleScore,
  rarityFloorForScale,
} from "@/server/economy/rates";
import { RARITIES } from "@/lib/constants";

describe("coin earning", () => {
  it("pays a fraction of task XP", () => {
    expect(coinsForTask(100)).toBe(35);
  });

  it("never pays zero for a completed task", () => {
    expect(coinsForTask(1)).toBeGreaterThanOrEqual(1);
    expect(coinsForTask(0)).toBeGreaterThanOrEqual(1);
  });

  it("pays more for later milestones", () => {
    expect(coinsForMilestone(3)).toBeGreaterThan(coinsForMilestone(0));
  });

  it("scales goal completion with difficulty", () => {
    expect(coinsForGoalCompletion(5)).toBeGreaterThan(coinsForGoalCompletion(1));
  });

  it("clamps out-of-range goal difficulty", () => {
    expect(coinsForGoalCompletion(99)).toBe(coinsForGoalCompletion(5));
    expect(coinsForGoalCompletion(-4)).toBe(coinsForGoalCompletion(1));
  });

  it("pays achievements by tier, ascending", () => {
    expect(coinsForAchievement("platinum")).toBeGreaterThan(coinsForAchievement("gold"));
    expect(coinsForAchievement("gold")).toBeGreaterThan(coinsForAchievement("silver"));
    expect(coinsForAchievement("silver")).toBeGreaterThan(coinsForAchievement("bronze"));
  });

  it("falls back to the bronze rate for an unknown tier", () => {
    expect(coinsForAchievement("nonsense")).toBe(coinsForAchievement("bronze"));
  });

  it("pays nothing for a non-milestone streak day", () => {
    expect(coinsForStreak(0)).toBe(0);
  });

  it("scales level-up bonuses with level", () => {
    expect(coinsForLevelUp(10)).toBeGreaterThan(coinsForLevelUp(2));
  });
});

describe("goalScaleScore", () => {
  it("stays within 0..100", () => {
    const tiny = goalScaleScore({ difficulty: 1, targetLevel: 1, timelineWeeks: 1 });
    const huge = goalScaleScore({ difficulty: 5, targetLevel: 200, timelineWeeks: 500 });
    expect(tiny).toBeGreaterThanOrEqual(0);
    expect(huge).toBeLessThanOrEqual(100);
  });

  it("rates a long hard goal above a short easy one", () => {
    const small = goalScaleScore({ difficulty: 2, targetLevel: 12, timelineWeeks: 8 });
    const big = goalScaleScore({ difficulty: 5, targetLevel: 28, timelineWeeks: 60 });
    expect(big).toBeGreaterThan(small);
  });

  it("defaults a missing timeline rather than collapsing to zero", () => {
    expect(goalScaleScore({ difficulty: 3, targetLevel: 20 })).toBeGreaterThan(0);
  });
});

describe("rarityFloorForScale", () => {
  it("returns a known rarity for any score in 0..100", () => {
    for (let s = 0; s <= 100; s++) {
      expect(RARITIES).toContain(rarityFloorForScale(s));
    }
  });

  it("never decreases as scale increases", () => {
    let prev = 0;
    for (let s = 0; s <= 100; s++) {
      const rank = RARITIES.indexOf(rarityFloorForScale(s));
      expect(rank).toBeGreaterThanOrEqual(prev);
      prev = rank;
    }
  });

  it("reserves mythic for the very top of the range", () => {
    expect(rarityFloorForScale(100)).toBe("mythic");
    expect(rarityFloorForScale(94)).not.toBe("mythic");
  });
});
