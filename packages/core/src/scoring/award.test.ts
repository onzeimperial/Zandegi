import { describe, expect, it } from "vitest";
import {
  AWARD_CALCULATOR_VERSION,
  NEUTRAL_STEP_BASE_XP,
  isAwardingMethod,
  neutralChapterAward,
  neutralMissionAward,
  neutralStepAward,
} from "./award";

describe("neutral step award", () => {
  it("pays stronger evidence more, from one fixed base", () => {
    expect(neutralStepAward("SELF")).toEqual({
      xp: 40,
      base: NEUTRAL_STEP_BASE_XP,
      verificationMult: 1,
      calculatorVersion: AWARD_CALCULATOR_VERSION,
    });
    expect(neutralStepAward("ARTIFACT").xp).toBe(50);
    expect(neutralStepAward("ARTIFACT").xp).toBeGreaterThan(neutralStepAward("SELF").xp);
  });

  it("takes no input the model writes, so the model cannot move it (law 5)", () => {
    // The signature is the guarantee: evidence in, award out. There is no
    // estimate, difficulty or title to pass.
    expect(neutralStepAward.length).toBe(1);
  });

  it("pays nothing for INTEGRATION evidence in the MVP (FR18)", () => {
    expect(isAwardingMethod("INTEGRATION")).toBe(false);
    expect(isAwardingMethod("SELF")).toBe(true);
    expect(isAwardingMethod("ARTIFACT")).toBe(true);
  });
});

describe("neutral chapter and mission awards", () => {
  it("pays a chapter 2.5 times the base of each of its steps", () => {
    expect(neutralChapterAward(4)).toBe(400);
    expect(neutralChapterAward(0)).toBe(0);
  });

  it("pays a mission 4 times its largest chapter bonus", () => {
    expect(neutralMissionAward([3, 5, 4])).toBe(4 * neutralChapterAward(5));
    expect(neutralMissionAward([])).toBe(0);
  });

  it("rejects a step count that is not a non-negative integer", () => {
    expect(() => neutralChapterAward(-1)).toThrow(RangeError);
    expect(() => neutralChapterAward(2.5)).toThrow(RangeError);
  });
});
