/**
 * Stage 7 — Score. **Deterministic. No model involvement** (SPEC §2.2,
 * CLAUDE.md §2.5). Everything numeric comes from @zandegi/core.
 */

import { stepBaseXp, chapterCompletionXp, missionCompletionXp } from "@zandegi/core";
import type { DraftMission, ScoredMission, ScoredChapter, ScoredStep } from "../types";

export interface ScoreContext {
  /** From the resolved pursuit (0.5–2.0). */
  difficultyPrior: number;
  /** Per-user adaptive multiplier. 1.0 for a fresh user / the harness. */
  userAdaptive: number;
  currentStreakDays: number;
  weakestDomain: string | null;
  /** Population exclusivity 0..1. 0 when there is no population yet (the harness). */
  rarityScore: number;
}

export const NEUTRAL_CONTEXT: ScoreContext = {
  difficultyPrior: 1,
  userAdaptive: 1,
  currentStreakDays: 0,
  weakestDomain: null,
  rarityScore: 0,
};

export function scoreMission(mission: DraftMission, ctx: ScoreContext): ScoredMission {
  const scoredChapters: ScoredChapter[] = mission.chapters.map((chapter) => {
    const scoredSteps: ScoredStep[] = chapter.steps.map((step) => ({
      ...step,
      baseXp: stepBaseXp(step.estimatedMinutes),
    }));
    return {
      index: chapter.index,
      title: chapter.title,
      exitCondition: chapter.exitCondition,
      steps: scoredSteps,
      completionXp: chapterCompletionXp(scoredSteps.map((s) => s.baseXp)),
    };
  });

  return {
    title: mission.title,
    goalType: mission.goalType,
    primaryDomain: mission.primaryDomain,
    chapters: scoredChapters,
    completionXp: missionCompletionXp(scoredChapters.map((c) => c.completionXp)),
  };
}
