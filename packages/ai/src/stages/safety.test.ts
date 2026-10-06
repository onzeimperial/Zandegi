import { describe, it, expect } from "vitest";
import { safetyPass } from "./08-safety";
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
    const draft = missionWith("anything");
    const r = safetyPass(draft, "SELF_HARM_ADJACENT");
    expect(r.outcome.blocked).toBe(true);
    expect(r.needsRewrite).toEqual([]);
  });

  it("applies a professional frame for CLINICAL / FINANCIAL / LEGAL", () => {
    for (const c of ["CLINICAL", "FINANCIAL", "LEGAL"] as const) {
      const draft = missionWith("neutral advice");
      expect(safetyPass(draft, c).outcome.professionalFrameApplied).toBe(true);
    }
    const normal = safetyPass(missionWith("x"), "NORMAL");
    expect(normal.outcome.professionalFrameApplied).toBe(false);
  });

  it("flags a calorie target in a CLINICAL mission for rewrite", () => {
    const draft = missionWith("Eat 1200 kcal a day to lose fat.");
    const r = safetyPass(draft, "CLINICAL");
    expect(r.needsRewrite.length).toBeGreaterThan(0);
    expect(r.outcome.redactions.join(" ")).toMatch(/1200/);
  });

  it("flags an unsafe weight-loss rate", () => {
    const draft = missionWith("Aim to lose 2 kg per week.");
    expect(safetyPass(draft, "CLINICAL").needsRewrite.length).toBeGreaterThan(0);
  });

  it("flags personal financial advice", () => {
    const draft = missionWith("You should invest in an index fund now.");
    expect(safetyPass(draft, "FINANCIAL").needsRewrite.length).toBeGreaterThan(0);
  });

  it("leaves a clean NORMAL mission untouched", () => {
    const draft = missionWith("Run three easy sessions this week.");
    const r = safetyPass(draft, "NORMAL");
    expect(r.needsRewrite).toEqual([]);
    expect(r.outcome.blocked).toBe(false);
  });
});
