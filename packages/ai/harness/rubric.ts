/**
 * The session-1 scoring rubric. Six axes, 1–5. A model scores each generated
 * mission against these — but the mission's *numbers* (XP, difficulty) are
 * never judged by the model; only its *content* is (CLAUDE.md §2.5).
 *
 * The judge call needs ANTHROPIC_API_KEY. The rubric definition, the prompt,
 * and the parse/aggregate logic here do not.
 */

import { z } from "zod";
import type { ScoredMission } from "../src/types";
import type { HarnessGoal } from "./goals";

export const RUBRIC_AXES = [
  "specificity", // could this mission only be for THIS goal?
  "actionability", // can a step be started today without more research?
  "grounding", // are facts sourced and dated, or honestly hedged?
  "sequencing", // do the chapters actually build on each other?
  "toolFit", // are the attached tools the right ones for the work?
  "honesty", // does it avoid fake precision and false confidence?
] as const;

export type RubricAxis = (typeof RUBRIC_AXES)[number];

export const AXIS_DESCRIPTION: Record<RubricAxis, string> = {
  specificity:
    "5 = every chapter and step is unmistakably about this exact goal, with the person's stated constraints reflected. 1 = generic template that would fit any goal in the domain.",
  actionability:
    "5 = the first step of every chapter can be done today with what a normal person has. 1 = steps are outcomes ('get fit') or need research before they can start.",
  grounding:
    "5 = every factual claim (dates, prices, requirements) carries a dated source, or is written as 'check the current…' advice. 1 = confident unsourced claims about deadlines, rules, or prices.",
  sequencing:
    "5 = chapter 2 genuinely depends on chapter 1; exit conditions are real thresholds. 1 = chapters are parallel or arbitrary; exit conditions are 'when you feel ready'.",
  toolFit:
    "5 = attached tools are exactly what this work needs (a timer for study, a tracker for a lift). 1 = wrong tools, or a wall of tools, or none where one is obviously needed.",
  honesty:
    "5 = no percentage on an OUTCOME goal, no invented odds, hedges where the future is unknown. 1 = fake precision ('you're 73% ready'), false certainty about admissions/markets.",
};

export const rubricScoreSchema = z.object({
  specificity: z.number().int().min(1).max(5),
  actionability: z.number().int().min(1).max(5),
  grounding: z.number().int().min(1).max(5),
  sequencing: z.number().int().min(1).max(5),
  toolFit: z.number().int().min(1).max(5),
  honesty: z.number().int().min(1).max(5),
  /** One sentence naming the single biggest weakness. */
  worstFailure: z.string(),
});

export type RubricScore = z.infer<typeof rubricScoreSchema>;

export function buildJudgePrompt(goal: HarnessGoal, mission: ScoredMission): string {
  const axes = RUBRIC_AXES.map((a) => `- ${a}: ${AXIS_DESCRIPTION[a]}`).join("\n");
  return [
    `You are grading a generated life-mission for quality. Be a harsh grader.`,
    ``,
    `The person typed this goal, verbatim:`,
    `"""${goal.text}"""`,
    ``,
    `Here is the mission that was generated for it (JSON):`,
    "```json",
    JSON.stringify(
      {
        title: mission.title,
        goalType: mission.goalType,
        primaryDomain: mission.primaryDomain,
        chapters: mission.chapters.map((c) => ({
          title: c.title,
          exitCondition: c.exitCondition,
          steps: c.steps.map((s) => ({
            title: s.title,
            estimatedMinutes: s.estimatedMinutes,
            verification: s.verification,
            guide: s.guide,
            sources: s.sources,
            toolKinds: s.toolKinds,
          })),
        })),
      },
      null,
      2,
    ),
    "```",
    ``,
    `Score each axis 1–5:`,
    axes,
    ``,
    `Return ONLY JSON: { "specificity": n, "actionability": n, "grounding": n, "sequencing": n, "toolFit": n, "honesty": n, "worstFailure": "…" }`,
  ].join("\n");
}

export function meanScore(scores: RubricScore[], axis: RubricAxis): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s[axis], 0) / scores.length;
}

export interface RubricSummary {
  n: number;
  means: Record<RubricAxis, number>;
  /** Session-1 exit bar: mean specificity and actionability both ≥ 4.0. */
  passesExitBar: boolean;
}

export function summariseScores(scores: RubricScore[]): RubricSummary {
  const means = Object.fromEntries(
    RUBRIC_AXES.map((a) => [a, meanScore(scores, a)]),
  ) as Record<RubricAxis, number>;
  return {
    n: scores.length,
    means,
    passesExitBar: means.specificity >= 4.0 && means.actionability >= 4.0,
  };
}
