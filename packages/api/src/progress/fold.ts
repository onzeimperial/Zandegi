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
          chapterIndex: event.chapterIndex,
          stepIndex: event.stepIndex,
          evidence: event.evidence.kind,
          xp: event.award.xp,
          recordedAt: event.recordedAt,
        });
        break;
      case "ChapterCompleted":
        totalXp += event.xp;
        completedChapters.push({ missionId: event.missionId, chapterIndex: event.chapterIndex });
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

/** The steps of one mission that are complete, as `"chapter:step"` keys. */
export function completedStepKeys(progress: ProgressView, missionId: string): Set<string> {
  return new Set(
    progress.completions
      .filter((completion) => completion.missionId === missionId)
      .map((completion) => `${completion.chapterIndex}:${completion.stepIndex}`),
  );
}

/**
 * The first step not yet completed, walking chapters and steps in order, or
 * `null` when every step is done. Steps complete in order, so this is the only
 * step that can be completed next.
 */
export function nextStep(
  chapterStepCounts: readonly number[],
  completed: ReadonlySet<string>,
): { chapterIndex: number; stepIndex: number } | null {
  for (let chapterIndex = 0; chapterIndex < chapterStepCounts.length; chapterIndex++) {
    for (let stepIndex = 0; stepIndex < chapterStepCounts[chapterIndex]!; stepIndex++) {
      if (!completed.has(`${chapterIndex}:${stepIndex}`)) return { chapterIndex, stepIndex };
    }
  }
  return null;
}
