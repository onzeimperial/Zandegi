import { describe, it, expect } from "vitest";
import { safetyPass } from "./08-safety";
import { scoreMission, NEUTRAL_CONTEXT } from "./07-score";
import type { DraftMission } from "../types";

function missionWith(approach: string): DraftMission {
  return {
    title: "Test",
    goalType: "METRIC",
    primaryDomain: "Body",
    chapters: [
      {
        index: 0,
        title: "Chapter",
        exitCondition: "done",
        steps: [
          {
            index: 0,
            title: "Step",
            estimatedMinutes: 30,
            verification: "SELF",
            guide: { approach, materials: [], commonMistakes: [], whatGoodLooksLike: "ok" },
            sources: [],
            toolKinds: [],
          },
        ],
      },
    ],
  };
}

describe("safetyPass", () => {
  it("blocks generation entirely for SELF_HARM_ADJACENT", () => {
    const scored = scoreMission(missionWith("anything"), NEUTRAL_CONTEXT);
    const r = safetyPass(scored, "SELF_HARM_ADJACENT");
    expect(r.outcome.blocked).toBe(true);
    expect(r.needsRewrite).toEqual([]);
  });

  it("applies a professional frame for CLINICAL / FINANCIAL / LEGAL", () => {
    for (const c of ["CLINICAL", "FINANCIAL", "LEGAL"] as const) {
      const scored = scoreMission(missionWith("neutral advice"), NEUTRAL_CONTEXT);
      expect(safetyPass(scored, c).outcome.professionalFrameApplied).toBe(true);
    }
    const normal = safetyPass(scoreMission(missionWith("x"), NEUTRAL_CONTEXT), "NORMAL");
    expect(normal.outcome.professionalFrameApplied).toBe(false);
  });

  it("flags a calorie target in a CLINICAL mission for rewrite", () => {
    const scored = scoreMission(missionWith("Eat 1200 kcal a day to lose fat."), NEUTRAL_CONTEXT);
    const r = safetyPass(scored, "CLINICAL");
    expect(r.needsRewrite.length).toBeGreaterThan(0);
    expect(r.outcome.redactions.join(" ")).toMatch(/1200/);
  });

  it("flags an unsafe weight-loss rate", () => {
    const scored = scoreMission(missionWith("Aim to lose 2 kg per week."), NEUTRAL_CONTEXT);
    expect(safetyPass(scored, "CLINICAL").needsRewrite.length).toBeGreaterThan(0);
  });

  it("flags personal financial advice", () => {
    const scored = scoreMission(missionWith("You should invest in an index fund now."), NEUTRAL_CONTEXT);
    expect(safetyPass(scored, "FINANCIAL").needsRewrite.length).toBeGreaterThan(0);
  });

  it("leaves a clean NORMAL mission untouched", () => {
    const scored = scoreMission(missionWith("Run three easy sessions this week."), NEUTRAL_CONTEXT);
    const r = safetyPass(scored, "NORMAL");
    expect(r.needsRewrite).toEqual([]);
    expect(r.outcome.blocked).toBe(false);
  });
});
