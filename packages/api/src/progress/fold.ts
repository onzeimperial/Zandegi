/**
 * Derive a person's progress by folding their ledger (law 4).
 *
 * Pure: the same events always produce the same progress, in any process, on
 * any day. There is no stored running total to drift out of step with the
 * events -- the events are the only truth.
 */

import { levelProgress, rankForLevel } from "@zandegi/core";
import type { ProgressView, StepCompletionView } from "../client";
import { parseLedgerEvent, type LedgerEvent } from "./ledger";

/** Parse stored entries, dropping any this version cannot read. */
export function readEvents(entries: readonly unknown[]): LedgerEvent[] {
  return entries.map(parseLedgerEvent).filter((event): event is LedgerEvent => event !== null);
}

export function foldProgress(events: readonly LedgerEvent[]): ProgressView {
  let totalXp = 0;
  const completions: StepCompletionView[] = [];
  const completedChapters: ProgressView["completedChapters"] = [];
  const completedMissions: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case "StepCompleted":
        totalXp += event.award.xp;
        completions.push({
          missionId: event.missionId,
          chapterId: event.chapterId,
          stepId: event.stepId,
          evidence: event.evidence.kind,
          xp: event.award.xp,
          recordedAt: event.recordedAt,
        });
        break;
      case "ChapterCompleted":
        totalXp += event.xp;
        completedChapters.push({ missionId: event.missionId, chapterId: event.chapterId });
        break;
      case "MissionCompleted":
        totalXp += event.xp;
        completedMissions.push(event.missionId);
        break;
    }
  }

  const level = levelProgress(totalXp);
  return {
    totalXp,
    level: level.level,
    rank: rankForLevel(level.level),
    xpIntoLevel: level.xpIntoLevel,
    xpForThisLevel: level.xpForThisLevel,
    completions,
    completedChapters,
    completedMissions,
  };
}

/** The ids of one mission's completed steps, including steps since deleted. */
export function completedStepIds(progress: ProgressView, missionId: string): Set<string> {
  return new Set(
    progress.completions
      .filter((completion) => completion.missionId === missionId)
      .map((completion) => completion.stepId),
  );
}

/**
 * The first step not yet completed, walking chapters and steps in their current
 * order, or `null` when every step is done. Steps complete in order, so this is
 * the only step that can be completed next. A reorder changes which step this
 * is; it never changes which steps are done.
 */
export function nextStep(
  chapters: readonly { id: string; steps: readonly { id: string }[] }[],
  completed: ReadonlySet<string>,
): { chapterId: string; stepId: string } | null {
  for (const chapter of chapters) {
    for (const step of chapter.steps) {
      if (!completed.has(step.id)) return { chapterId: chapter.id, stepId: step.id };
    }
  }
  return null;
}
