import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it } from "vitest";
import type { BossDebrief, GenerationSafetyClass, MissionDraft } from "../client";
import { demoPortsFromStore } from "../demo-store";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { applyPlanEdit } from "../plan/edit-plan";
import { upcastMission, type StoredMissionDraft } from "../plan/ids";
import { fixedClock, sequentialIdGenerator, type MissionGoalContext } from "../ports";
import {
  completeStep,
  readProgress,
  type CompletionEvidenceInput,
} from "../progress/complete-step";
import { attemptBoss, bossAttemptId, parseBossAttemptRequest } from "./attempt-boss";

const OWNER: GuestPrincipal = { id: "owner-1", createdAt: "2026-11-12T00:00:00.000Z" };
const INTRUDER: GuestPrincipal = { id: "owner-2", createdAt: "2026-11-12T00:00:00.000Z" };
const SELF: CompletionEvidenceInput = { kind: "SELF" };
/** The leading bytes of a real JPEG; enough for the sniffer. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const DEBRIEF: BossDebrief = { didntGoWell: "Lost my breath at 3km, private detail" };

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

/** Two chapters of two steps each. */
const MISSION: StoredMissionDraft = {
  title: "Half Marathon",
  goalType: "PROJECT",
  primaryDomain: "Body",
  chapters: [
    {
      index: 0,
      title: "Base",
      exitCondition: "Run 5km without stopping",
      steps: [step(0), step(1)],
    },
    { index: 1, title: "Build", exitCondition: "Run 10km", steps: [step(0), step(1)] },
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

let keys = 0;
const freshKey = () => `attempt-key-${++keys}`;

async function setup(mission: MissionDraft = upcastMission(MISSION)) {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: "2026-11-12T00:00:00.000Z",
    goalText: "run a half marathon",
    pursuitSlug: "run-a-half-marathon",
    mission,
    safetyClass: "NORMAL",
  });
  const ports = {
    persistence: demo.persistence,
    ledger: demo.ledger,
    plans: demo.plans,
    bosses: demo.bosses,
    clock: fixedClock(new Date("2026-11-12T09:00:00.000Z")),
    ids: sequentialIdGenerator("id"),
  };
  const complete = (stepId: string, evidence: CompletionEvidenceInput = SELF) =>
    completeStep({ principal: OWNER, missionId: "m-1", stepId, evidence }, ports);
  const attempt = (
    request: Record<string, unknown>,
    evidence: CompletionEvidenceInput = SELF,
    principal: GuestPrincipal = OWNER,
  ) =>
    attemptBoss(
      {
        principal,
        missionId: "m-1",
        request: { attemptKey: freshKey(), ...DEBRIEF, ...request },
        evidence,
      },
      ports,
    );
  const xp = async () => (await readProgress({ principal: OWNER }, ports)).totalXp;
  const read = async () => (await store.findMission(OWNER.id, "m-1"))!;
  const ledgerTypes = async () =>
    (await store.readLedger(OWNER.id)).map((entry) => (entry as { type: string }).type);
  return { store, ports, complete, attempt, xp, read, ledgerTypes };
}

describe("parsing a boss attempt", () => {
  const valid = { chapterId: "0", result: "done", attemptKey: "key-12345", tips: "warm up" };

  it("accepts a result with one answer and drops empty answers", () => {
    expect(parseBossAttemptRequest({ ...valid, wentWell: "   " })).toEqual({
      chapterId: "0",
      result: "done",
      skipRest: false,
      attemptKey: "key-12345",
      debrief: { tips: "warm up" },
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ["no answer at all", { ...valid, tips: undefined }],
    ["only blank answers", { ...valid, tips: " ", improve: "\n" }],
    ["a partly band", { ...valid, result: "partly" }],
    ["an unknown field", { ...valid, xp: 400 }],
    ["a missing attempt key", { ...valid, attemptKey: undefined }],
    ["a malformed chapter id", { ...valid, chapterId: "../0" }],
    ["an improvement over two lines", { ...valid, improve: "a\nb" }],
    ["an improvement too long for a step", { ...valid, improve: "x".repeat(201) }],
    ["an answer over the limit", { ...valid, tips: "x".repeat(501) }],
    ["a skip flag that is not a boolean", { ...valid, skipRest: "yes" }],
  ])("refuses %s", (_label, request) => {
    expect(() => parseBossAttemptRequest(request)).toThrow(GenerationError);
  });
});

describe("attempting a boss (the I/O matrix)", () => {
  it("done: closes the chapter, pays the done band, and opens the next with the improve step", async () => {
    const { complete, attempt, xp, read, store } = await setup();
    await complete("0:0");
    await complete("0:1");

    const result = await attempt({ chapterId: "0", result: "done", improve: "Pace the first km" });
    expect(result.awards).toEqual([{ kind: "boss", xp: 400 }]);
    expect(result.progress.completedChapters).toEqual([{ missionId: "m-1", chapterId: "0" }]);
    expect(result.improveStep).toEqual({ chapterId: "1", stepId: "own-1" });
    expect(await xp()).toBe(40 + 40 + 400);

    // The improve step is the next chapter's first step, the person's own, and pays nothing.
    const chapter = (await read()).mission.chapters[1]!;
    expect(chapter.steps.map((entry) => entry.id)).toEqual(["own-1", "1:0", "1:1"]);
    expect(chapter.steps[0]).toMatchObject({ title: "Pace the first km", writtenBy: "person" });
    expect((await complete("own-1")).awards).toEqual([{ kind: "step", xp: 0 }]);

    // The raw result and the debrief are on the deletable record.
    expect(await store.listBossAttempts(OWNER.id, "m-1")).toEqual([
      expect.objectContaining({
        attemptId: result.attemptId,
        result: "done",
        evidence: "SELF",
        improve: "Pace the first km",
      }),
    ]);
  });

  it("not yet: closes the chapter at 0 XP and leaves the boss open to try again", async () => {
    const { complete, attempt, xp } = await setup();
    await complete("0:0");
    await complete("0:1");

    const result = await attempt({ chapterId: "0", result: "not-yet" });
    expect(result.awards).toEqual([]);
    expect(result.progress.completedChapters).toEqual([{ missionId: "m-1", chapterId: "0" }]);
    expect(result.progress.bosses).toEqual([
      { missionId: "m-1", chapterId: "0", outcome: "not-yet", xp: 0 },
    ]);
    expect(await xp()).toBe(80);
    // The next chapter has opened.
    expect((await complete("1:0")).awards).toEqual([{ kind: "step", xp: 40 }]);
  });

  it("try again: a later done pays the done band once, and a second done pays 0", async () => {
    const { complete, attempt, xp, ledgerTypes } = await setup();
    await complete("0:0");
    await complete("0:1");
    await attempt({ chapterId: "0", result: "not-yet" });

    const retry = await attempt(
      { chapterId: "0", result: "done" },
      { kind: "ARTIFACT", bytes: JPEG },
    );
    expect(retry.awards).toEqual([{ kind: "boss", xp: 450 }]);
    expect(retry.progress.completedChapters).toHaveLength(1);

    const again = await attempt({ chapterId: "0", result: "done" });
    expect(again.awards).toEqual([]);
    expect(await xp()).toBe(80 + 450);
    expect(await ledgerTypes()).toEqual([
      "StepCompleted",
      "StepCompleted",
      "BossResolved",
      "BossResolved",
    ]);
  });

  it("try again: a second not yet records the debrief and changes no progress", async () => {
    const { complete, attempt, ledgerTypes, store } = await setup();
    await complete("0:0");
    await complete("0:1");
    await attempt({ chapterId: "0", result: "not-yet" });
    await attempt({ chapterId: "0", result: "not-yet" });
    expect(await ledgerTypes()).toEqual(["StepCompleted", "StepCompleted", "BossResolved"]);
    expect(await store.listBossAttempts(OWNER.id, "m-1")).toHaveLength(2);
  });

  it("double submit: the same attempt sent twice closes once, pays once and is saved once", async () => {
    const { complete, attempt, xp, store, ledgerTypes } = await setup();
    await complete("0:0");
    await complete("0:1");
    const request = { chapterId: "0", result: "done", attemptKey: "same-key-1" };

    // A send that races the first may be told to try again, never told an outcome
    // that is not recorded yet.
    const racing = await Promise.allSettled([attempt(request), attempt(request)]);
    const answered = racing.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []));
    for (const entry of racing) {
      if (entry.status === "rejected") {
        expect((entry.reason as GenerationError).code).toBe("STORE_UNAVAILABLE");
      }
    }
    const third = await attempt(request);
    const ids = [...answered, third].map((entry) => entry.attemptId);
    expect(ids.filter((id) => id !== null)).toHaveLength(1);
    expect([...answered, third].flatMap((entry) => entry.awards)).toEqual([
      { kind: "boss", xp: 400 },
    ]);
    expect(third.result).toBe("done");
    expect(await xp()).toBe(480);
    expect(await store.listBossAttempts(OWNER.id, "m-1")).toHaveLength(1);
    expect(await ledgerTypes()).toEqual(["StepCompleted", "StepCompleted", "BossResolved"]);
  });

  it("double submit of not yet: one close", async () => {
    const { complete, attempt, ledgerTypes } = await setup();
    await complete("0:0");
    await complete("0:1");
    const request = { chapterId: "0", result: "not-yet", attemptKey: "same-key-2" };
    await Promise.allSettled([attempt(request), attempt(request)]);
    expect(await ledgerTypes()).toEqual(["StepCompleted", "StepCompleted", "BossResolved"]);
  });

  it("a resent attempt key answers what was recorded, never the changed form", async () => {
    const { complete, attempt, xp } = await setup();
    await complete("0:0");
    await complete("0:1");
    const first = await attempt({ chapterId: "0", result: "not-yet", attemptKey: "changed-1" });
    expect(first.result).toBe("not-yet");

    const resent = await attempt({ chapterId: "0", result: "done", attemptKey: "changed-1" });
    expect(resent).toMatchObject({ attemptId: null, result: "not-yet", awards: [] });
    expect(await xp()).toBe(80);
  });

  it("a resend reports the step its improve answer already became", async () => {
    const { complete, attempt, read } = await setup();
    await complete("0:0");
    await complete("0:1");
    const request = { chapterId: "0", result: "done", attemptKey: "improve-1", improve: "Pace it" };
    const first = await attempt(request);
    const resent = await attempt(request);
    expect(resent.improveStep).toEqual(first.improveStep);
    expect((await read()).mission.chapters[1]!.steps.map((entry) => entry.id)).toEqual([
      "own-1",
      "1:0",
      "1:1",
    ]);
  });

  it("try again adds no second copy of the same improve step, and none once beaten", async () => {
    const { complete, attempt, read } = await setup();
    await complete("0:0");
    await complete("0:1");
    await attempt({ chapterId: "0", result: "not-yet", improve: "Pace it" });
    const retry = await attempt({ chapterId: "0", result: "done", improve: " Pace it " });
    expect(retry.improveStep).toEqual({ chapterId: "1", stepId: "own-1" });
    const later = await attempt({ chapterId: "0", result: "done", improve: "Something new" });
    expect(later.improveStep).toBeNull();
    expect((await read()).mission.chapters[1]!.steps.map((entry) => entry.id)).toEqual([
      "own-1",
      "1:0",
      "1:1",
    ]);
  });

  it("adds no improve step to a next chapter that has already closed", async () => {
    const { complete, attempt, read } = await setup();
    await complete("0:0");
    await complete("0:1");
    await attempt({ chapterId: "0", result: "not-yet" });
    await complete("1:0");
    await complete("1:1");
    await attempt({ chapterId: "1", result: "done" });

    const retry = await attempt({ chapterId: "0", result: "done", improve: "Pace it" });
    expect(retry.improveStep).toBeNull();
    expect((await read()).mission.chapters[1]!.steps.map((entry) => entry.id)).toEqual([
      "1:0",
      "1:1",
    ]);
  });

  it("keeps a photo's fingerprint on the ledger event, never the photo", async () => {
    const { complete, attempt, store } = await setup();
    await complete("0:0");
    await complete("0:1");
    await attempt({ chapterId: "0", result: "done" }, { kind: "ARTIFACT", bytes: JPEG });
    const event = (await store.readLedger(OWNER.id)).at(-1) as { evidence: unknown };
    expect(event.evidence).toEqual({
      kind: "ARTIFACT",
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      bytes: JPEG.length,
      mediaType: "image/jpeg",
    });
    expect(JSON.stringify(event)).not.toContain(String(Array.from(JPEG)));
  });

  it("skip: undone steps are skipped, unpaid, and can never be completed later", async () => {
    const { complete, attempt, xp } = await setup();
    await complete("0:0");

    const result = await attempt({ chapterId: "0", result: "done", skipRest: true });
    expect(result.awards).toEqual([{ kind: "boss", xp: 400 }]);
    expect(await xp()).toBe(40 + 400);
    expect((await failure(() => complete("0:1"))).code).toBe("STEP_NOT_CURRENT");
    expect((await complete("1:0")).awards).toEqual([{ kind: "step", xp: 40 }]);
  });

  it("no debrief: nothing is saved, and the code is INVALID_REQUEST", async () => {
    const { complete, ports, store, ledgerTypes } = await setup();
    await complete("0:0");
    await complete("0:1");
    const error = await failure(() =>
      attemptBoss(
        {
          principal: OWNER,
          missionId: "m-1",
          request: { chapterId: "0", result: "done", attemptKey: freshKey(), tips: "  " },
          evidence: SELF,
        },
        ports,
      ),
    );
    expect(error.code).toBe("INVALID_REQUEST");
    expect(await store.listBossAttempts(OWNER.id, "m-1")).toEqual([]);
    expect(await ledgerTypes()).toEqual(["StepCompleted", "StepCompleted"]);
  });

  it("too early: undone steps and no skip save nothing, and the code is BOSS_NOT_READY", async () => {
    const { complete, attempt, store, ledgerTypes } = await setup();
    await complete("0:0");
    expect((await failure(() => attempt({ chapterId: "0", result: "done" }))).code).toBe(
      "BOSS_NOT_READY",
    );
    // A later chapter's boss is not ready while an earlier chapter is open, skip or not.
    expect(
      (await failure(() => attempt({ chapterId: "1", result: "done", skipRest: true }))).code,
    ).toBe("BOSS_NOT_READY");
    expect(await store.listBossAttempts(OWNER.id, "m-1")).toEqual([]);
    expect(await ledgerTypes()).toEqual(["StepCompleted"]);
  });

  it("legacy: a chapter closed under neutral-v1 stays closed and offers no boss", async () => {
    const { store, attempt, xp, complete } = await setup();
    await store.claimCompletion(OWNER.id, "m-1:chapter:0");
    await store.appendLedger(OWNER.id, {
      version: 1,
      eventId: "legacy-c0",
      missionId: "m-1",
      recordedAt: "2026-10-08T09:00:00.000Z",
      type: "ChapterCompleted",
      chapterIndex: 0,
      xp: 200,
      calculatorVersion: "neutral-v1",
    });
    expect((await failure(() => attempt({ chapterId: "0", result: "done" }))).code).toBe(
      "INVALID_REQUEST",
    );
    expect(await xp()).toBe(200);
    expect((await complete("1:0")).awards).toEqual([{ kind: "step", xp: 40 }]);
  });

  it("foreign mission: nothing is saved or revealed", async () => {
    const { complete, attempt, store } = await setup();
    await complete("0:0");
    await complete("0:1");
    const error = await failure(() => attempt({ chapterId: "0", result: "done" }, SELF, INTRUDER));
    expect(error.code).toBe("MISSION_NOT_FOUND");
    expect(await store.listBossAttempts(INTRUDER.id, "m-1")).toEqual([]);
    expect(await store.listBossAttempts(OWNER.id, "m-1")).toEqual([]);
  });

  it("refuses an unknown chapter and evidence other than a check or a photo", async () => {
    const { complete, attempt } = await setup();
    await complete("0:0");
    await complete("0:1");
    expect((await failure(() => attempt({ chapterId: "9", result: "done" }))).code).toBe(
      "INVALID_REQUEST",
    );
    for (const kind of ["METRIC", "TIMER", "INTEGRATION"]) {
      const evidence = { kind } as unknown as CompletionEvidenceInput;
      expect(
        (await failure(() => attempt({ chapterId: "0", result: "done" }, evidence))).code,
      ).toBe("INVALID_REQUEST");
    }
  });

  it("checks a photo before anything is claimed, so a rejected one costs nothing", async () => {
    const { complete, attempt } = await setup();
    await complete("0:0");
    await complete("0:1");
    const svg = new TextEncoder().encode("<svg/>");
    const request = { chapterId: "0", result: "done", attemptKey: "photo-key-1" };
    expect((await failure(() => attempt(request, { kind: "ARTIFACT", bytes: svg }))).code).toBe(
      "EVIDENCE_REJECTED",
    );
    expect((await attempt(request, { kind: "ARTIFACT", bytes: JPEG })).awards).toEqual([
      { kind: "boss", xp: 450 },
    ]);
  });
});

describe("records stay out of the ledger", () => {
  it("writes only the reference and the pricing facts, never the debrief", async () => {
    const { complete, attempt, store } = await setup();
    await complete("0:0");
    await complete("0:1");
    const result = await attempt({
      chapterId: "0",
      result: "done",
      tips: "Secret tip text",
      improve: "Secret improvement",
    });
    const ledger = await store.readLedger(OWNER.id);
    expect(ledger.at(-1)).toEqual({
      version: 2,
      eventId: expect.any(String),
      missionId: "m-1",
      recordedAt: "2026-11-12T09:00:00.000Z",
      type: "BossResolved",
      attemptId: result.attemptId,
      chapterId: "0",
      band: "done",
      evidence: { kind: "SELF" },
      xp: 400,
      selfDeclared: true,
      calculatorVersion: "progression-v2",
    });
    const text = JSON.stringify(ledger);
    for (const secret of ["Secret tip text", "Secret improvement", DEBRIEF.didntGoWell!]) {
      expect(text).not.toContain(secret);
    }
  });

  it("keeps the ledger intact when a person deletes their debrief", async () => {
    const { complete, attempt, store, xp } = await setup();
    await complete("0:0");
    await complete("0:1");
    const { attemptId } = await attempt({ chapterId: "0", result: "done" });
    expect(await store.deleteBossAttempt(OWNER.id, attemptId!)).toBe(true);
    expect(await xp()).toBe(480);
  });

  it("releases the attempt when the record fails to save, so the same attempt can be resent", async () => {
    const { complete, ports, xp, store } = await setup();
    await complete("0:0");
    await complete("0:1");
    let failNext = true;
    const flaky = {
      ...ports,
      bosses: {
        ...ports.bosses,
        record: async (record: Parameters<typeof ports.bosses.record>[0]) => {
          if (failNext) {
            failNext = false;
            throw new Error("database write failed");
          }
          return ports.bosses.record(record);
        },
      },
    };
    const send = () =>
      attemptBoss(
        {
          principal: OWNER,
          missionId: "m-1",
          request: { chapterId: "0", result: "done", attemptKey: "flaky-key-1", ...DEBRIEF },
          evidence: SELF,
        },
        flaky,
      );
    expect((await failure(send)).code).toBe("STORE_UNAVAILABLE");
    const retry = await send();
    // The band was paid by the first try; the retry saves the debrief and pays nothing more.
    expect(retry.attemptId).not.toBeNull();
    expect(retry.awards).toEqual([]);
    expect(await xp()).toBe(480);
    const records = await store.listBossAttempts(OWNER.id, "m-1");
    expect(records).toHaveLength(1);
    // The event written by the failed send and the record saved by the resend share one id.
    const event = (await store.readLedger(OWNER.id)).at(-1) as { attemptId: string };
    expect(records[0]!.attemptId).toBe(event.attemptId);
    expect(retry.attemptId).toBe(event.attemptId);
    expect(event.attemptId).toBe(await bossAttemptId("m-1", "flaky-key-1"));
  });
});

describe("the mission reward", () => {
  async function finishChapter(
    run: Awaited<ReturnType<typeof setup>>,
    chapterId: string,
    stepIds: string[],
    result: "done" | "not-yet",
  ) {
    for (const stepId of stepIds) await run.complete(stepId);
    return run.attempt({ chapterId, result });
  }

  it("pays 1,500 once every boss is done", async () => {
    const run = await setup();
    await finishChapter(run, "0", ["0:0", "0:1"], "done");
    const last = await finishChapter(run, "1", ["1:0", "1:1"], "done");
    expect(last.awards).toEqual([
      { kind: "boss", xp: 400 },
      { kind: "mission", xp: 1500 },
    ]);
    expect(last.progress.completedMissions).toEqual(["m-1"]);
    // 4 steps, 2 bosses, the mission: nothing scales with the step count.
    expect(await run.xp()).toBe(160 + 800 + 1500);
  });

  it("waits for a not-yet boss, and pays when try-again reaches done", async () => {
    const run = await setup();
    await finishChapter(run, "0", ["0:0", "0:1"], "not-yet");
    const last = await finishChapter(run, "1", ["1:0", "1:1"], "done");
    expect(last.awards).toEqual([{ kind: "boss", xp: 400 }]);

    const retry = await run.attempt({ chapterId: "0", result: "done" });
    expect(retry.awards).toEqual([
      { kind: "boss", xp: 400 },
      { kind: "mission", xp: 1500 },
    ]);
    expect((await run.attempt({ chapterId: "1", result: "done" })).awards).toEqual([]);
  });

  it("is the same with added steps as without them", async () => {
    const plain = await setup();
    await finishChapter(plain, "0", ["0:0", "0:1"], "done");
    await finishChapter(plain, "1", ["1:0", "1:1"], "done");

    const withAdded = await setup(
      applyPlanEdit(
        applyPlanEdit(upcastMission(MISSION), { op: "addStep", chapterId: "0", title: "Stretch" }),
        { op: "addStep", chapterId: "1", title: "Foam roll" },
      ),
    );
    await finishChapter(withAdded, "0", ["0:0", "0:1", "own-1"], "done");
    await finishChapter(withAdded, "1", ["1:0", "1:1", "own-2"], "done");

    expect(await withAdded.xp()).toBe(await plain.xp());
  });

  it("pays a mission whose first chapter closed under neutral-v1 once its boss is beaten", async () => {
    const legacyClosed = async () => {
      const run = await setup();
      await run.store.claimCompletion(OWNER.id, "m-1:chapter:0");
      await run.store.appendLedger(OWNER.id, {
        version: 1,
        eventId: "legacy-c0",
        missionId: "m-1",
        recordedAt: "2026-10-08T09:00:00.000Z",
        type: "ChapterCompleted",
        chapterIndex: 0,
        xp: 200,
        calculatorVersion: "neutral-v1",
      });
      return run;
    };

    const run = await legacyClosed();
    const last = await finishChapter(run, "1", ["1:0", "1:1"], "done");
    expect(last.awards.filter((award) => award.kind === "mission")).toEqual([
      { kind: "mission", xp: 1500 },
    ]);

    // A mission already paid under neutral-v1 is never paid again.
    const paid = await legacyClosed();
    await paid.store.claimCompletion(OWNER.id, "m-1:mission");
    const again = await finishChapter(paid, "1", ["1:0", "1:1"], "done");
    expect(again.awards).toEqual([{ kind: "boss", xp: 400 }]);
  });

  it("pays a mission reward whose write failed when the same attempt is resent", async () => {
    const run = await setup();
    await finishChapter(run, "0", ["0:0", "0:1"], "done");
    for (const stepId of ["1:0", "1:1"]) await run.complete(stepId);

    let failMission = true;
    const flaky = {
      ...run.ports,
      ledger: {
        ...run.ports.ledger,
        append: async (ownerId: string, event: Parameters<typeof run.ports.ledger.append>[1]) => {
          if (failMission && event.type === "MissionCompleted") {
            failMission = false;
            throw new Error("database write failed");
          }
          return run.ports.ledger.append(ownerId, event);
        },
      },
    };
    const send = () =>
      attemptBoss(
        {
          principal: OWNER,
          missionId: "m-1",
          request: { chapterId: "1", result: "done", attemptKey: "mission-key-1", ...DEBRIEF },
          evidence: SELF,
        },
        flaky,
      );
    expect((await failure(send)).code).toBe("STORE_UNAVAILABLE");
    const resent = await send();
    expect(resent.awards).toEqual([{ kind: "mission", xp: 1500 }]);
    expect(await run.xp()).toBe(160 + 800 + 1500);
  });

  it("adds no improve step after the last chapter", async () => {
    const run = await setup();
    await finishChapter(run, "0", ["0:0", "0:1"], "done");
    for (const stepId of ["1:0", "1:1"]) await run.complete(stepId);
    const last = await run.attempt({ chapterId: "1", result: "done", improve: "Rest more" });
    expect(last.improveStep).toBeNull();
    expect((await run.read()).mission.chapters[1]!.steps).toHaveLength(2);
  });
});
