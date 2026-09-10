import { describe, it, expect } from "vitest";
import {
  stepBaseXp,
  difficultyMult,
  streakMult,
  balanceMult,
  rarityMult,
  stepXp,
  chapterCompletionXp,
  missionCompletionXp,
  STEP_XP_MIN,
  STEP_XP_MAX,
} from "./xp";

describe("stepBaseXp", () => {
  it("is one point per minute, bounded 5..240", () => {
    expect(stepBaseXp(30)).toBe(30);
    expect(stepBaseXp(1)).toBe(5);
    expect(stepBaseXp(0)).toBe(5);
    expect(stepBaseXp(1000)).toBe(240);
  });
});

describe("difficultyMult", () => {
  it("is the product of the two priors, clamped to 0.5..2.0", () => {
    expect(difficultyMult(1, 1)).toBe(1);
    expect(difficultyMult(2, 2)).toBe(2); // clamped down from 4
    expect(difficultyMult(0.5, 0.5)).toBe(0.5); // clamped up from 0.25
    expect(difficultyMult(1.2, 1.3)).toBeCloseTo(1.56);
  });
});

describe("streakMult", () => {
  it("grows 1% per day and caps at +25%", () => {
    expect(streakMult(0)).toBe(1);
    expect(streakMult(10)).toBeCloseTo(1.1);
    expect(streakMult(25)).toBeCloseTo(1.25);
    expect(streakMult(400)).toBeCloseTo(1.25);
  });
  it("treats negative streak as zero", () => {
    expect(streakMult(-5)).toBe(1);
  });
});

describe("balanceMult", () => {
  it("is +10% only for the weakest domain", () => {
    expect(balanceMult(true)).toBe(1.1);
    expect(balanceMult(false)).toBe(1);
  });
});

describe("rarityMult", () => {
  it("ranges 1.0 (common) to 1.5 (mythic-rare)", () => {
    expect(rarityMult(0)).toBe(1);
    expect(rarityMult(1)).toBe(1.5);
    expect(rarityMult(0.5)).toBe(1.25);
  });
  it("clamps out-of-range scores", () => {
    expect(rarityMult(-2)).toBe(1);
    expect(rarityMult(9)).toBe(1.5);
  });
});

describe("stepXp", () => {
  const baseInput = {
    estimatedMinutes: 60,
    difficultyPrior: 1,
    userAdaptive: 1,
    verification: "SELF" as const,
    currentStreakDays: 0,
    isWeakestDomain: false,
  };

  it("with all-neutral inputs, equals the base", () => {
    expect(stepXp(baseInput).xp).toBe(60);
  });

  it("stacks multipliers", () => {
    const r = stepXp({
      ...baseInput,
      verification: "INTEGRATION", // 1.4
      currentStreakDays: 25, // 1.25
      isWeakestDomain: true, // 1.1
      rarityScore: 1, // 1.5
      difficultyPrior: 1.5,
      userAdaptive: 1, // 1.5
    });
    // 60 × 1.5 × 1.4 × 1.25 × 1.1 × 1.5 = 259.875 -> 260
    expect(r.xp).toBe(260);
    expect(r.multipliers.verification).toBe(1.4);
  });

  it("never returns less than 5 or more than 900", () => {
    const low = stepXp({ ...baseInput, estimatedMinutes: 5, difficultyPrior: 0.5, userAdaptive: 1 });
    expect(low.xp).toBeGreaterThanOrEqual(STEP_XP_MIN);
    const high = stepXp({
      ...baseInput,
      estimatedMinutes: 240,
      difficultyPrior: 2,
      userAdaptive: 1,
      verification: "INTEGRATION",
      currentStreakDays: 25,
      isWeakestDomain: true,
      rarityScore: 1,
    });
    expect(high.xp).toBeLessThanOrEqual(STEP_XP_MAX);
    expect(high.xp).toBe(STEP_XP_MAX); // this combination does hit the ceiling
  });

  it("exposes a breakdown for auditability", () => {
    const r = stepXp(baseInput);
    expect(r.base).toBe(60);
    expect(Object.keys(r.multipliers).sort()).toEqual([
      "balance",
      "difficulty",
      "rarity",
      "streak",
      "verification",
    ]);
    expect(r.raw).toBeGreaterThan(0);
  });

  it("is deterministic — same input, same output", () => {
    expect(stepXp(baseInput)).toEqual(stepXp(baseInput));
  });
});

describe("chapter and mission awards", () => {
  it("chapter = 2.5× the sum of step base XP", () => {
    expect(chapterCompletionXp([20, 30, 50])).toBe(250);
    expect(chapterCompletionXp([])).toBe(0);
  });

  it("mission = 4× the largest chapter award", () => {
    expect(missionCompletionXp([250, 400, 300])).toBe(1600);
    expect(missionCompletionXp([])).toBe(0);
  });
});
