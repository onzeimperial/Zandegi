import { describe, expect, it } from "vitest";
import {
  AWARD_CALCULATOR_VERSION,
  neutralChapterAward,
  neutralMissionAward,
  neutralStepAward,
} from "./award";
import { levelFromXp, xpForLevel } from "./levels";
import {
  PROGRESSION_V2,
  PROGRESSION_V2_VERSION,
  progressionV2BossAward,
  progressionV2MissionAward,
  progressionV2StepAward,
  type BossBand,
  type ProgressionV2Evidence,
} from "./progression";

describe("progression-v2 config", () => {
  it("holds the values the human decided on 2026-11-12", () => {
    expect(PROGRESSION_V2).toEqual({
      version: "progression-v2",
      stepXp: { SELF: 40, ARTIFACT: 50 },
      chapterStepXpCap: 450,
      boss: { done: 400, photoBonus: 50, notYet: 0 },
      missionXp: 1500,
    });
    expect(PROGRESSION_V2_VERSION).not.toBe(AWARD_CALCULATOR_VERSION);
  });

  it("is frozen, so no caller can retune it at runtime", () => {
    expect(Object.isFrozen(PROGRESSION_V2)).toBe(true);
    expect(Object.isFrozen(PROGRESSION_V2.stepXp)).toBe(true);
    expect(Object.isFrozen(PROGRESSION_V2.boss)).toBe(true);
  });
});

describe("progression-v2 step award", () => {
  it("pays 40 for a check and 50 for a photo, stamped with its version", () => {
    expect(progressionV2StepAward("SELF", 0)).toEqual({
      xp: 40,
      base: 40,
      verificationMult: 1,
      calculatorVersion: "progression-v2",
    });
    expect(progressionV2StepAward("ARTIFACT", 0).xp).toBe(50);
  });

  it("cuts the award at the per-chapter cap and pays 0 beyond it", () => {
    expect(progressionV2StepAward("SELF", 400).xp).toBe(40);
    expect(progressionV2StepAward("ARTIFACT", 420).xp).toBe(30);
    expect(progressionV2StepAward("SELF", 450).xp).toBe(0);
    expect(progressionV2StepAward("ARTIFACT", 9_000).xp).toBe(0);
  });

  it("never lets a chapter's steps pay more than the cap, however many there are", () => {
    let paid = 0;
    for (let step = 0; step < 40; step += 1) {
      paid += progressionV2StepAward(step % 2 === 0 ? "SELF" : "ARTIFACT", paid).xp;
    }
    expect(paid).toBe(PROGRESSION_V2.chapterStepXpCap);
  });

  it("takes only the evidence and the amount already paid (law 5)", () => {
    expect(progressionV2StepAward.length).toBe(2);
  });

  it("refuses evidence the policy does not accept and amounts that are not whole", () => {
    for (const kind of ["METRIC", "TIMER", "INTEGRATION"]) {
      expect(() => progressionV2StepAward(kind as ProgressionV2Evidence, 0)).toThrow(RangeError);
    }
    expect(() => progressionV2StepAward("SELF", -1)).toThrow(RangeError);
    expect(() => progressionV2StepAward("SELF", 2.5)).toThrow(RangeError);
    expect(() => progressionV2StepAward("SELF", Number.NaN)).toThrow(RangeError);
  });
});

describe("progression-v2 boss award", () => {
  it("pays 400 for done, 450 with a photo, and 0 for not yet", () => {
    expect(progressionV2BossAward("done", "SELF")).toEqual({
      xp: 400,
      band: "done",
      evidence: "SELF",
      calculatorVersion: "progression-v2",
    });
    expect(progressionV2BossAward("done", "ARTIFACT").xp).toBe(450);
    expect(progressionV2BossAward("not-yet", "SELF").xp).toBe(0);
    expect(progressionV2BossAward("not-yet", "ARTIFACT").xp).toBe(0);
  });

  it("takes only the band and the evidence (law 5)", () => {
    expect(progressionV2BossAward.length).toBe(2);
  });

  it("refuses METRIC, TIMER and INTEGRATION evidence and an unknown band", () => {
    for (const kind of ["METRIC", "TIMER", "INTEGRATION"]) {
      expect(() => progressionV2BossAward("done", kind as ProgressionV2Evidence)).toThrow(
        RangeError,
      );
    }
    expect(() => progressionV2BossAward("partly" as BossBand, "SELF")).toThrow(RangeError);
  });
});

describe("progression-v2 mission award", () => {
  it("pays 1,500 only when every boss is done", () => {
    expect(progressionV2MissionAward(["done", "done", "done"])).toBe(1500);
    expect(progressionV2MissionAward(["done", "not-yet", "done"])).toBe(0);
    expect(progressionV2MissionAward(["done", null])).toBe(0);
    expect(progressionV2MissionAward([])).toBe(0);
  });

  it("does not scale with how many chapters or steps a mission has", () => {
    expect(progressionV2MissionAward(["done"])).toBe(
      progressionV2MissionAward(Array.from({ length: 12 }, () => "done" as const)),
    );
  });
});

/**
 * Golden fixtures: what `neutral-v1` paid before this policy existed. If any of
 * these move, an old event's meaning has changed, which law 4 forbids.
 */
describe("neutral-v1 golden fixtures", () => {
  it("keeps every neutral-v1 amount exactly as it was", () => {
    expect(AWARD_CALCULATOR_VERSION).toBe("neutral-v1");
    expect(neutralStepAward("SELF")).toEqual({
      xp: 40,
      base: 40,
      verificationMult: 1,
      calculatorVersion: "neutral-v1",
    });
    expect(neutralStepAward("ARTIFACT").xp).toBe(50);
    expect(neutralStepAward("TIMER").xp).toBe(46);
    expect(neutralStepAward("METRIC").xp).toBe(52);
    expect([1, 2, 3, 4, 5, 6].map(neutralChapterAward)).toEqual([100, 200, 300, 400, 500, 600]);
    expect(neutralMissionAward([2, 2])).toBe(800);
    expect(neutralMissionAward([3, 5, 4])).toBe(2000);
  });

  it("keeps the level curve unchanged", () => {
    expect([1, 2, 5, 10, 25, 50].map(xpForLevel)).toEqual([0, 303, 1313, 3981, 17247, 52282]);
    expect(levelFromXp(1360)).toBe(5);
  });
});
