import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it } from "vitest";
import type { GenerationSafetyClass, MissionDraft } from "../client";
import { demoPortsFromStore } from "../demo-store";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { fixedClock, sequentialIdGenerator, type MissionGoalContext } from "../ports";
import { completeStep, readProgress } from "../progress/complete-step";
import { upcastMission, type StoredMissionDraft } from "./ids";
import { listLogs, logProgress, moveLog, parseLogInput } from "./logs";

const OWNER: GuestPrincipal = { id: "owner-1", createdAt: "2026-11-12T00:00:00.000Z" };
const INTRUDER: GuestPrincipal = { id: "owner-2", createdAt: "2026-11-12T00:00:00.000Z" };
const NOTE = "Ran 3km before work, felt strong";

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

const MISSION: StoredMissionDraft = {
  title: "Half Marathon",
  goalType: "METRIC",
  primaryDomain: "Body",
  chapters: [
    { index: 0, title: "Base", exitCondition: "Run 5km", steps: [step(0)] },
    { index: 1, title: "Build", exitCondition: "Run 10km", steps: [step(0)] },
  ],
};

async function failure(run: () => Promise<unknown>): Promise<GenerationError> {
  const caught = await run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(GenerationError);
  return caught as GenerationError;
}

async function setup() {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: "2026-11-12T00:00:00.000Z",
    goalText: "run a half marathon",
    pursuitSlug: "run-a-half-marathon",
    mission: upcastMission(MISSION),
    safetyClass: "NORMAL",
  });
  const ports = {
    persistence: demo.persistence,
    ledger: demo.ledger,
    logs: demo.logs,
    clock: fixedClock(new Date("2026-11-12T09:00:00.000Z")),
    ids: sequentialIdGenerator("log"),
  };
  const log = (request: unknown, principal: GuestPrincipal = OWNER) =>
    logProgress({ principal, missionId: "m-1", request }, ports);
  return { store, ports, log };
}

describe("parsing a log", () => {
  it("accepts a note, and a number with or without a unit", () => {
    expect(parseLogInput({ kind: "note", text: `  ${NOTE} ` })).toEqual({
      kind: "note",
      text: NOTE,
    });
    expect(parseLogInput({ kind: "number", value: 72.5, unit: "kg" })).toEqual({
      kind: "number",
      value: 72.5,
      unit: "kg",
    });
    expect(parseLogInput({ kind: "number", value: -3, unit: " " })).toEqual({
      kind: "number",
      value: -3,
    });
  });

  it.each([
    ["an empty note", { kind: "note", text: "  " }],
    ["a note over two lines", { kind: "note", text: "a\nb" }],
    ["a note over the limit", { kind: "note", text: "x".repeat(281) }],
    ["a number that is text", { kind: "number", value: "5" }],
    ["a number that is not finite", { kind: "number", value: Number.POSITIVE_INFINITY }],
    ["a number out of range", { kind: "number", value: 2e9 }],
    ["a unit over the limit", { kind: "number", value: 1, unit: "x".repeat(25) }],
    ["a photo", { kind: "photo", url: "x" }],
    ["an XP claim", { kind: "note", text: "hi", xp: 100 }],
  ])("refuses %s", (_label, body) => {
    expect(() => parseLogInput(body)).toThrow(GenerationError);
  });
});

describe("logging progress", () => {
  it("files a note under the current chapter, with no XP event", async () => {
    const { log, store, ports } = await setup();
    const saved = await log({ kind: "note", text: NOTE });
    expect(saved).toEqual({
      logId: "log-1",
      missionId: "m-1",
      chapterId: "0",
      kind: "note",
      text: NOTE,
      loggedAt: "2026-11-12T09:00:00.000Z",
    });
    expect(await store.readLedger(OWNER.id)).toEqual([]);
    expect((await readProgress({ principal: OWNER }, ports)).totalXp).toBe(0);
    expect(await listLogs({ principal: OWNER, missionId: "m-1" }, ports)).toEqual([saved]);
  });

  it("follows the current chapter as steps are completed", async () => {
    const { log, ports } = await setup();
    await completeStep(
      { principal: OWNER, missionId: "m-1", stepId: "0:0", evidence: { kind: "SELF" } },
      { ...ports, ids: sequentialIdGenerator("event") },
    );
    expect((await log({ kind: "number", value: 5, unit: "km" })).chapterId).toBe("1");
  });

  it("moves a log to another chapter of the same mission", async () => {
    const { log, ports } = await setup();
    const saved = await log({ kind: "note", text: NOTE });
    const moved = await moveLog(
      { principal: OWNER, missionId: "m-1", logId: saved.logId, request: { chapterId: "1" } },
      ports,
    );
    expect(moved).toEqual({ ...saved, chapterId: "1" });
    expect((await listLogs({ principal: OWNER, missionId: "m-1" }, ports))[0]!.chapterId).toBe("1");
  });

  it("refuses a move to a chapter that is not in the mission", async () => {
    const { log, ports } = await setup();
    const saved = await log({ kind: "note", text: NOTE });
    for (const request of [{ chapterId: "7" }, { chapterId: "1", text: "edit" }, null]) {
      const error = await failure(() =>
        moveLog({ principal: OWNER, missionId: "m-1", logId: saved.logId, request }, ports),
      );
      expect(error.code).toBe("INVALID_REQUEST");
    }
  });

  it("foreign mission: nothing is saved or revealed", async () => {
    const { log, ports } = await setup();
    const saved = await log({ kind: "note", text: NOTE });

    expect((await failure(() => log({ kind: "note", text: "mine" }, INTRUDER))).code).toBe(
      "MISSION_NOT_FOUND",
    );
    expect(
      (await failure(() => listLogs({ principal: INTRUDER, missionId: "m-1" }, ports))).code,
    ).toBe("MISSION_NOT_FOUND");
    expect(
      (
        await failure(() =>
          moveLog(
            {
              principal: INTRUDER,
              missionId: "m-1",
              logId: saved.logId,
              request: { chapterId: "1" },
            },
            ports,
          ),
        )
      ).code,
    ).toBe("MISSION_NOT_FOUND");
    expect(await listLogs({ principal: OWNER, missionId: "m-1" }, ports)).toEqual([saved]);
  });

  it("answers an unknown log as not found", async () => {
    const { ports } = await setup();
    const error = await failure(() =>
      moveLog(
        { principal: OWNER, missionId: "m-1", logId: "never-issued", request: { chapterId: "1" } },
        ports,
      ),
    );
    expect(error.code).toBe("MISSION_NOT_FOUND");
  });

  it("keeps the log text out of every diagnostic", async () => {
    const { ports } = await setup();
    const broken = {
      ...ports,
      logs: {
        ...ports.logs,
        record: async () => {
          throw new Error("insert failed");
        },
      },
    };
    const error = await failure(() =>
      logProgress(
        { principal: OWNER, missionId: "m-1", request: { kind: "note", text: NOTE } },
        broken,
      ),
    );
    expect(error.code).toBe("STORE_UNAVAILABLE");
    expect(error.diagnostic).not.toContain(NOTE);
    const invalid = await failure(() =>
      logProgress(
        { principal: OWNER, missionId: "m-1", request: { kind: "note", text: `${NOTE}\nmore` } },
        ports,
      ),
    );
    expect(invalid.diagnostic).not.toContain(NOTE);
  });
});
