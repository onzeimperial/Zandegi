import { describe, expect, it } from "vitest";
import { foldProgress, nextStep, readEvents } from "./fold";
import type { LedgerEvent } from "./ledger";

const base = { version: 1 as const, missionId: "m-1", recordedAt: "2026-10-09T09:00:00.000Z" };
const award = { xp: 40, base: 40, verificationMult: 1, calculatorVersion: "neutral-v1" };

const stepDone = (chapterIndex: number, stepIndex: number): LedgerEvent => ({
  ...base,
  eventId: `e-${chapterIndex}-${stepIndex}`,
  type: "StepCompleted",
  chapterIndex,
  stepIndex,
  evidence: { kind: "SELF" },
  award,
});

describe("folding the ledger into progress", () => {
  it("starts a new character at level 1 with no XP", () => {
    expect(foldProgress([])).toMatchObject({
      totalXp: 0,
      level: 1,
      rank: "Wanderer",
      completions: [],
    });
  });

  it("derives XP from events rather than any stored total", () => {
    const progress = foldProgress([
      stepDone(0, 0),
      stepDone(0, 1),
      {
        ...base,
        eventId: "c-0",
        type: "ChapterCompleted",
        chapterIndex: 0,
        xp: 200,
        calculatorVersion: "neutral-v1",
      },
    ]);
    expect(progress.totalXp).toBe(280);
    expect(progress.completedChapters).toEqual([{ missionId: "m-1", chapterIndex: 0 }]);
  });

  it("skips an unreadable entry instead of losing every other one", () => {
    const events = readEvents([stepDone(0, 0), { type: "StepCompleted" }, "garbage", null]);
    expect(events).toHaveLength(1);
    expect(foldProgress(events).totalXp).toBe(40);
  });

  it("is deterministic: the same events always fold to the same progress", () => {
    const events = [stepDone(0, 0), stepDone(0, 1)];
    expect(foldProgress(events)).toEqual(foldProgress(events));
  });
});

describe("the next step", () => {
  it("walks chapters and steps in order", () => {
    expect(nextStep([2, 2], new Set())).toEqual({ chapterIndex: 0, stepIndex: 0 });
    expect(nextStep([2, 2], new Set(["0:0", "0:1"]))).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it("is null once every step is done", () => {
    expect(nextStep([1, 1], new Set(["0:0", "1:0"]))).toBeNull();
  });
});
