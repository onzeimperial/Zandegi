import { describe, expect, it } from "vitest";
import {
  chapterBoss,
  closedChapterIds,
  completedStepIds,
  foldProgress,
  missionPosition,
  nextStep,
  readEvents,
} from "./fold";
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

  it("walks chapters and steps in their current order, stopping at an open chapter", () => {
    expect(nextStep(chapters, new Set())).toEqual({ chapterId: "0", stepId: "0:0" });
    // Chapter 0's steps are done but it is not closed: its boss comes first.
    expect(nextStep(chapters, new Set(["0:0", "0:1"]))).toBeNull();
    expect(nextStep(chapters, new Set(["0:0", "0:1"]), new Set(["0"]))).toEqual({
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

describe("the mission position", () => {
  const chapters = [
    { id: "0", steps: [{ id: "0:0" }, { id: "0:1" }] },
    { id: "1", steps: [{ id: "1:0" }] },
  ];

  it("is a step, then the open chapter's boss, then the next chapter", () => {
    expect(missionPosition(chapters, new Set(["0:0"]))).toEqual({
      kind: "step",
      chapterId: "0",
      stepId: "0:1",
    });
    expect(missionPosition(chapters, new Set(["0:0", "0:1"]))).toEqual({
      kind: "boss",
      chapterId: "0",
    });
    expect(missionPosition(chapters, new Set(["0:0", "0:1"]), new Set(["0"]))).toEqual({
      kind: "step",
      chapterId: "1",
      stepId: "1:0",
    });
    expect(missionPosition(chapters, new Set(), new Set(["0", "1"]))).toEqual({
      kind: "finished",
    });
  });

  it("passes over a closed chapter's undone steps for good: they are skipped", () => {
    // Chapter 0 closed with 0:1 never done, so it is never current again.
    expect(missionPosition(chapters, new Set(["0:0"]), new Set(["0"]))).toEqual({
      kind: "step",
      chapterId: "1",
      stepId: "1:0",
    });
  });
});

describe("boss events", () => {
  const boss = (eventId: string, band: "done" | "not-yet", xp: number): LedgerEvent => ({
    ...base,
    eventId,
    type: "BossResolved",
    attemptId: `a-${eventId}`,
    chapterId: "0",
    band,
    evidence: "SELF",
    xp,
    selfDeclared: true,
    calculatorVersion: "progression-v2",
  });

  it("closes the chapter whatever the result, and keeps the best outcome", () => {
    const notYet = foldProgress([boss("b1", "not-yet", 0)]);
    expect(notYet.completedChapters).toEqual([{ missionId: "m-1", chapterId: "0" }]);
    expect(notYet.bosses).toEqual([
      { missionId: "m-1", chapterId: "0", outcome: "not-yet", xp: 0 },
    ]);
    expect(notYet.totalXp).toBe(0);

    const retried = foldProgress([boss("b1", "not-yet", 0), boss("b2", "done", 450)]);
    expect(retried.completedChapters).toEqual([{ missionId: "m-1", chapterId: "0" }]);
    expect(chapterBoss(retried, "m-1", "0")).toEqual({
      missionId: "m-1",
      chapterId: "0",
      outcome: "done",
      xp: 450,
    });
    expect(retried.totalXp).toBe(450);
    expect([...closedChapterIds(retried, "m-1")]).toEqual(["0"]);
  });

  it("reads a stored boss event back, and rejects one that is not self-declared", () => {
    const event = boss("b1", "done", 400);
    expect(readEvents([event])).toEqual([event]);
    expect(readEvents([{ ...event, selfDeclared: false }])).toEqual([]);
    expect(readEvents([{ ...event, band: "partly" }])).toEqual([]);
    expect(readEvents([{ ...event, evidence: "METRIC" }])).toEqual([]);
  });

  it("uses the stored amount, never a recalculated one (law 4)", () => {
    expect(foldProgress([boss("b1", "done", 123)]).totalXp).toBe(123);
  });
});

/**
 * Golden fixture: a `neutral-v1` history exactly as the releases before boss
 * fights stored it, version 1 and version 2 events mixed. Its total, level and
 * closed chapters must never move.
 */
describe("neutral-v1 golden fixture", () => {
  const meta = (eventId: string, version: 1 | 2) => ({
    version,
    eventId,
    missionId: "m-1",
    recordedAt: "2026-10-09T09:00:00.000Z",
  });
  const photo = { kind: "ARTIFACT", sha256: "ab", bytes: 10, mediaType: "image/jpeg" };
  const history: unknown[] = [
    legacyStepDone(0, 0),
    legacyStepDone(0, 1),
    {
      ...meta("c0", 1),
      type: "ChapterCompleted",
      chapterIndex: 0,
      xp: 200,
      calculatorVersion: "neutral-v1",
    },
    {
      ...meta("s10", 2),
      type: "StepCompleted",
      chapterId: "1",
      stepId: "1:0",
      evidence: photo,
      award: { xp: 50, base: 40, verificationMult: 1.25, calculatorVersion: "neutral-v1" },
    },
    {
      ...meta("s11", 2),
      type: "StepCompleted",
      chapterId: "1",
      stepId: "1:1",
      evidence: { kind: "SELF" },
      award,
    },
    {
      ...meta("c1", 2),
      type: "ChapterCompleted",
      chapterId: "1",
      xp: 200,
      calculatorVersion: "neutral-v1",
    },
    { ...meta("m", 2), type: "MissionCompleted", xp: 800, calculatorVersion: "neutral-v1" },
  ];

  it("folds to the same total, level and closed chapters", () => {
    const progress = foldProgress(readEvents(history));
    expect(progress.totalXp).toBe(1370);
    expect(progress.level).toBe(5);
    expect(progress.completedChapters).toEqual([
      { missionId: "m-1", chapterId: "0" },
      { missionId: "m-1", chapterId: "1" },
    ]);
    expect(progress.completedMissions).toEqual(["m-1"]);
    expect(progress.bosses).toEqual([]);
  });
});
