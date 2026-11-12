import { describe, expect, it } from "vitest";
import { completedStepIds, foldProgress, nextStep, readEvents } from "./fold";
import { chapterClaimId, parseLedgerEvent, stepClaimId, type LedgerEvent } from "./ledger";

const base = { version: 2 as const, missionId: "m-1", recordedAt: "2026-10-09T09:00:00.000Z" };
const award = { xp: 40, base: 40, verificationMult: 1, calculatorVersion: "neutral-v1" };

const stepDone = (chapterId: string, stepId: string): LedgerEvent => ({
  ...base,
  eventId: `e-${stepId}`,
  type: "StepCompleted",
  chapterId,
  stepId,
  evidence: { kind: "SELF" },
  award,
});

/** A step event exactly as the pre-id release stored it. */
const legacyStepDone = (chapterIndex: number, stepIndex: number) => ({
  version: 1,
  eventId: `legacy-${chapterIndex}-${stepIndex}`,
  missionId: "m-1",
  recordedAt: "2026-10-09T09:00:00.000Z",
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
      stepDone("0", "0:0"),
      stepDone("0", "0:1"),
      {
        ...base,
        eventId: "c-0",
        type: "ChapterCompleted",
        chapterId: "0",
        xp: 200,
        calculatorVersion: "neutral-v1",
      },
    ]);
    expect(progress.totalXp).toBe(280);
    expect(progress.completedChapters).toEqual([{ missionId: "m-1", chapterId: "0" }]);
  });

  it("skips an unreadable entry instead of losing every other one", () => {
    const events = readEvents([stepDone("0", "0:0"), { type: "StepCompleted" }, "garbage", null]);
    expect(events).toHaveLength(1);
    expect(foldProgress(events).totalXp).toBe(40);
  });

  it("is deterministic: the same events always fold to the same progress", () => {
    const events = [stepDone("0", "0:0"), stepDone("0", "0:1")];
    expect(foldProgress(events)).toEqual(foldProgress(events));
  });
});

describe("upcasting position-keyed events", () => {
  it("gives a legacy step event the position id its mission upcasts to", () => {
    expect(parseLedgerEvent(legacyStepDone(1, 2))).toMatchObject({
      version: 1,
      type: "StepCompleted",
      chapterId: "1",
      stepId: "1:2",
      award,
    });
    expect(parseLedgerEvent(legacyStepDone(1, 2))).not.toHaveProperty("stepIndex");
  });

  it("upcasts a legacy chapter bonus and keeps a legacy mission bonus", () => {
    const meta = { eventId: "x", missionId: "m-1", recordedAt: "2026-10-09T09:00:00.000Z" };
    expect(
      parseLedgerEvent({
        ...meta,
        version: 1,
        type: "ChapterCompleted",
        chapterIndex: 3,
        xp: 200,
        calculatorVersion: "neutral-v1",
      }),
    ).toMatchObject({ chapterId: "3", xp: 200 });
    expect(
      parseLedgerEvent({
        ...meta,
        version: 1,
        type: "MissionCompleted",
        xp: 800,
        calculatorVersion: "neutral-v1",
      }),
    ).toMatchObject({ type: "MissionCompleted", xp: 800 });
  });

  it("folds legacy events to the same XP and completed steps as before", () => {
    const legacy = readEvents([legacyStepDone(0, 0), legacyStepDone(0, 1)]);
    const progress = foldProgress(legacy);
    expect(progress.totalXp).toBe(80);
    expect([...completedStepIds(progress, "m-1")]).toEqual(["0:0", "0:1"]);
  });

  it("keeps the claim keys of the release before ids, so a retry across the deploy pays once", () => {
    // The pre-id keys were `${missionId}:step:${c}:${s}` and `${missionId}:chapter:${c}`.
    expect(stepClaimId("m-1", "2:5")).toBe("m-1:step:2:5");
    expect(chapterClaimId("m-1", "2")).toBe("m-1:chapter:2");
  });

  it("rejects a malformed event of either version", () => {
    expect(parseLedgerEvent({ ...legacyStepDone(0, 0), stepIndex: -1 })).toBeNull();
    expect(parseLedgerEvent({ ...stepDone("0", "0:0"), stepId: "" })).toBeNull();
    expect(parseLedgerEvent({ ...stepDone("0", "0:0"), version: 3 })).toBeNull();
  });
});

describe("the next step", () => {
  const chapters = [
    { id: "0", steps: [{ id: "0:0" }, { id: "0:1" }] },
    { id: "1", steps: [{ id: "1:0" }, { id: "own-1" }] },
  ];

  it("walks chapters and steps in their current order", () => {
    expect(nextStep(chapters, new Set())).toEqual({ chapterId: "0", stepId: "0:0" });
    expect(nextStep(chapters, new Set(["0:0", "0:1"]))).toEqual({
      chapterId: "1",
      stepId: "1:0",
    });
  });

  it("is the first undone step in the new order after a reorder", () => {
    const reordered = [{ id: "0", steps: [{ id: "0:1" }, { id: "0:0" }] }, chapters[1]!];
    expect(nextStep(reordered, new Set(["0:0"]))).toEqual({ chapterId: "0", stepId: "0:1" });
  });

  it("is null once every step is done", () => {
    expect(nextStep(chapters, new Set(["0:0", "0:1", "1:0", "own-1"]))).toBeNull();
  });
});
