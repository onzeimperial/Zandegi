import { describe, it, expect } from "vitest";
import {
  RUBRIC_AXES,
  rubricScoreSchema,
  buildJudgePrompt,
  meanScore,
  summariseScores,
  type RubricScore,
} from "./rubric";
import { scoreMission, NEUTRAL_CONTEXT } from "../src/stages/07-score";
import type { DraftMission } from "../src/types";
import { HARNESS_GOALS } from "./goals";

const mission: DraftMission = {
  title: "Run a half marathon",
  goalType: "METRIC",
  primaryDomain: "Body",
  chapters: [
    {
      index: 0,
      title: "Base",
      exitCondition: "Run 8km continuously",
      steps: [
        {
          index: 0,
          title: "Easy 3km",
          estimatedMinutes: 25,
          verification: "INTEGRATION",
          guide: { approach: "Jog slow.", materials: ["shoes"], commonMistakes: ["going too fast"], whatGoodLooksLike: "Conversational." },
          sources: [],
          toolKinds: ["TIMER", "TRACKER"],
        },
      ],
    },
  ],
};

describe("rubric shape", () => {
  it("has the six spec axes", () => {
    expect([...RUBRIC_AXES]).toEqual([
      "specificity",
      "actionability",
      "grounding",
      "sequencing",
      "toolFit",
      "honesty",
    ]);
  });

  it("validates a well-formed score and rejects out-of-range", () => {
    const good: RubricScore = {
      specificity: 4,
      actionability: 5,
      grounding: 3,
      sequencing: 4,
      toolFit: 5,
      honesty: 4,
      worstFailure: "sources thin in chapter 2",
    };
    expect(rubricScoreSchema.safeParse(good).success).toBe(true);
    expect(rubricScoreSchema.safeParse({ ...good, honesty: 6 }).success).toBe(false);
    expect(rubricScoreSchema.safeParse({ ...good, specificity: 2.5 }).success).toBe(false);
  });
});

describe("buildJudgePrompt", () => {
  it("embeds the verbatim goal and the mission JSON", () => {
    const goal = HARNESS_GOALS[0]!;
    const prompt = buildJudgePrompt(goal, scoreMission(mission, NEUTRAL_CONTEXT));
    expect(prompt).toContain(goal.text);
    expect(prompt).toContain("Run a half marathon");
    expect(prompt).toContain("Return ONLY JSON");
  });
});

describe("aggregation", () => {
  const scores: RubricScore[] = [
    { specificity: 4, actionability: 4, grounding: 5, sequencing: 4, toolFit: 5, honesty: 5, worstFailure: "" },
    { specificity: 5, actionability: 4, grounding: 4, sequencing: 3, toolFit: 4, honesty: 5, worstFailure: "" },
  ];

  it("means an axis correctly", () => {
    expect(meanScore(scores, "specificity")).toBe(4.5);
    expect(meanScore([], "specificity")).toBe(0);
  });

  it("passes the exit bar only when specificity AND actionability both mean >= 4.0", () => {
    expect(summariseScores(scores).passesExitBar).toBe(true);
    const weak = [{ ...scores[0]!, actionability: 3 }];
    expect(summariseScores(weak).passesExitBar).toBe(false);
  });
});
