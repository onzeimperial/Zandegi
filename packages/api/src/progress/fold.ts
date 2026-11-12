/**
 * Derive a person's progress by folding their ledger (law 4).
 *
 * Pure: the same events always produce the same progress, in any process, on
 * any day. There is no stored running total to drift out of step with the
 * events -- the events are the only truth.
 */

import { levelProgress, rankForLevel } from "@zandegi/core";
import type { ChapterBossView, ProgressView, StepCompletionView } from "../client";
import { parseLedgerEvent, type LedgerEvent } from "./ledger";

/** Parse stored entries, dropping any this version cannot read. */
export function readEvents(entries: readonly unknown[]): LedgerEvent[] {
  return entries.map(parseLedgerEvent).filter((event): event is LedgerEvent => event !== null);
}

export function foldProgress(events: readonly LedgerEvent[]): ProgressView {
  let totalXp = 0;
  const completions: StepCompletionView[] = [];
  const completedChapters: ProgressView["completedChapters"] = [];
  const closed = new Set<string>();
  const bosses = new Map<string, ChapterBossView>();
  const completedMissions: string[] = [];
  const close = (missionId: string, chapterId: string) => {
    const key = `${missionId} ${chapterId}`;
    if (closed.has(key)) return;
    closed.add(key);
    completedChapters.push({ missionId, chapterId });
  };

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
        close(event.missionId, event.chapterId);
        break;
      case "BossResolved": {
        // The stored amount, never recalculated (law 4).
        totalXp += event.xp;
        close(event.missionId, event.chapterId);
        const key = `${event.missionId} ${event.chapterId}`;
        const seen = bosses.get(key);
        bosses.set(key, {
          missionId: event.missionId,
          chapterId: event.chapterId,
          outcome: seen?.outcome === "done" || event.band === "done" ? "done" : "not-yet",
          xp: (seen?.xp ?? 0) + event.xp,
        });
        break;
      }
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
    bosses: [...bosses.values()],
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

/** The ids of one mission's closed chapters: finished under `neutral-v1`, or by a boss attempt. */
export function closedChapterIds(progress: ProgressView, missionId: string): Set<string> {
  return new Set(
    progress.completedChapters
      .filter((chapter) => chapter.missionId === missionId)
      .map((chapter) => chapter.chapterId),
  );
}

/** One chapter's boss, or `undefined` if it has never been attempted. */
export function chapterBoss(
  progress: ProgressView,
  missionId: string,
  chapterId: string,
): ChapterBossView | undefined {
  return progress.bosses.find(
    (boss) => boss.missionId === missionId && boss.chapterId === chapterId,
  );
}

/** Where a person stands in one mission. */
export type MissionPosition =
  | { kind: "step"; chapterId: string; stepId: string }
  /** Every step of the open chapter is done: its boss is next. */
  | { kind: "boss"; chapterId: string }
  | { kind: "finished" };

/**
 * Walk chapters in order. A closed chapter is passed over, and any step left
 * undone in it is skipped for good. The first open chapter is where the person
 * is: its first undone step, or its boss once every step is done. Later
 * chapters stay shut until this one closes. A reorder changes which step is
 * next; it never changes which steps are done.
 */
export function missionPosition(
  chapters: readonly { id: string; steps: readonly { id: string }[] }[],
  completed: ReadonlySet<string>,
  closed: ReadonlySet<string> = new Set(),
): MissionPosition {
  for (const chapter of chapters) {
    if (closed.has(chapter.id)) continue;
    const step = chapter.steps.find((entry) => !completed.has(entry.id));
    return step === undefined
      ? { kind: "boss", chapterId: chapter.id }
      : { kind: "step", chapterId: chapter.id, stepId: step.id };
  }
  return { kind: "finished" };
}

/**
 * The only step that can be completed next, or `null` when the next thing is a
 * boss or the mission is finished. Steps complete in order.
 */
export function nextStep(
  chapters: readonly { id: string; steps: readonly { id: string }[] }[],
  completed: ReadonlySet<string>,
  closed: ReadonlySet<string> = new Set(),
): { chapterId: string; stepId: string } | null {
  const position = missionPosition(chapters, completed, closed);
  return position.kind === "step"
    ? { chapterId: position.chapterId, stepId: position.stepId }
    : null;
}
