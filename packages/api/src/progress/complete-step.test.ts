import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it } from "vitest";
import type { GenerationSafetyClass, MissionDraft, MissionStep } from "../client";
import { demoPortsFromStore } from "../demo-store";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { fixedClock, sequentialIdGenerator } from "../ports";
import { completeStep, readProgress, type CompletionEvidenceInput } from "./complete-step";

const OWNER: GuestPrincipal = { id: "guest-1", createdAt: "2026-10-09T00:00:00.000Z" };
const INTRUDER: GuestPrincipal = { id: "guest-2", createdAt: "2026-10-09T00:00:00.000Z" };
const SELF: CompletionEvidenceInput = { kind: "SELF" };

/** The leading bytes of a real JPEG; enough for the sniffer. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

function step(index: number, estimatedMinutes = 30): MissionStep {
  return {
    index,
    title: `Step ${index + 1}`,
    estimatedMinutes,
    verification: "SELF",
    guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "Done." },
    sources: [],
    toolKinds: [],
  };
}

/** Two chapters of two steps each. */
const MISSION: MissionDraft = {
  title: "Half Marathon",
  goalType: "METRIC",
  primaryDomain: "Body",
  chapters: [
    { index: 0, title: "Base", exitCondition: "Run 5km", steps: [step(0), step(1)] },
    { index: 1, title: "Build", exitCondition: "Run 10km", steps: [step(0), step(1)] },
  ],
};

async function setup(mission: MissionDraft = MISSION) {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: "2026-10-09T00:00:00.000Z",
    goalText: "run a half marathon in april",
    pursuitSlug: "run-a-half-marathon",
    mission,
    safetyClass: "NORMAL",
  });
  const ports = {
    persistence: demo.persistence,
    ledger: demo.ledger,
    clock: fixedClock(new Date("2026-10-09T09:00:00.000Z")),
    ids: sequentialIdGenerator("event"),
  };
  const complete = (
    chapterIndex: number,
    stepIndex: number,
    evidence: CompletionEvidenceInput = SELF,
    principal: GuestPrincipal = OWNER,
  ) => completeStep({ principal, missionId: "m-1", chapterIndex, stepIndex, evidence }, ports);
  return { store, ports, complete };
}

async function failure(run: () => Promise<unknown>): Promise<GenerationError> {
  const caught = await run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(GenerationError);
  return caught as GenerationError;
}

describe("completing a step", () => {
  it("pays a self-check 40 XP and records it", async () => {
    const { complete } = await setup();
    const result = await complete(0, 0);

    expect(result.awards).toEqual([{ kind: "step", xp: 40 }]);
    expect(result.progress.totalXp).toBe(40);
    expect(result.progress.completions).toEqual([
      {
        missionId: "m-1",
        chapterIndex: 0,
        stepIndex: 0,
        evidence: "SELF",
        xp: 40,
        recordedAt: "2026-10-09T09:00:00.000Z",
      },
    ]);
  });

  it("pays a photo more than a self-check", async () => {
    const { complete } = await setup();
    const result = await complete(0, 0, { kind: "ARTIFACT", bytes: JPEG });
    expect(result.awards).toEqual([{ kind: "step", xp: 50 }]);
    expect(result.progress.completions[0]?.evidence).toBe("ARTIFACT");
  });

  it("pays the same however long the model estimated the step (law 5)", async () => {
    const quick = await setup({
      ...MISSION,
      chapters: [{ ...MISSION.chapters[0]!, steps: [step(0, 5), step(1)] }],
    });
    const huge = await setup({
      ...MISSION,
      chapters: [{ ...MISSION.chapters[0]!, steps: [step(0, 900), step(1)] }],
    });
    expect((await quick.complete(0, 0)).awards).toEqual((await huge.complete(0, 0)).awards);
  });

  it("treats a repeat as harmless: it pays nothing and changes nothing", async () => {
    const { complete } = await setup();
    await complete(0, 0);
    const again = await complete(0, 0);

    expect(again.awards).toEqual([]);
    expect(again.progress.totalXp).toBe(40);
    expect(again.progress.completions).toHaveLength(1);
  });

  it("pays a step once, however many requests race for it", async () => {
    const { complete } = await setup();
    const results = await Promise.all([complete(0, 0), complete(0, 0), complete(0, 0)]);

    expect(results.flatMap((result) => result.awards)).toEqual([{ kind: "step", xp: 40 }]);
    expect((await complete(0, 0)).progress.totalXp).toBe(40);
  });

  it("refuses to skip ahead, and records nothing when it does", async () => {
    const { complete, ports } = await setup();
    const error = await failure(() => complete(0, 1));
    expect(error.code).toBe("STEP_NOT_CURRENT");
    expect((await readProgress({ principal: OWNER }, ports)).completions).toEqual([]);
  });

  it("answers another guest's mission exactly as a missing one", async () => {
    const { complete } = await setup();
    const error = await failure(() => complete(0, 0, SELF, INTRUDER));
    expect(error.code).toBe("MISSION_NOT_FOUND");
  });

  it("rejects a position outside the mission", async () => {
    const { complete } = await setup();
    expect((await failure(() => complete(9, 0))).code).toBe("INVALID_REQUEST");
    expect((await failure(() => complete(0, 9))).code).toBe("INVALID_REQUEST");
  });
});

describe("photo evidence", () => {
  it("rejects a file that is not a photo, without taking the step", async () => {
    const { complete } = await setup();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

    expect((await failure(() => complete(0, 0, { kind: "ARTIFACT", bytes: svg }))).code).toBe(
      "EVIDENCE_REJECTED",
    );
    // The step was never claimed, so the person can still complete it.
    expect((await complete(0, 0)).awards).toEqual([{ kind: "step", xp: 40 }]);
  });

  it("keeps a fingerprint in the ledger, never the photo or the goal", async () => {
    const { complete, store } = await setup();
    await complete(0, 0, { kind: "ARTIFACT", bytes: JPEG });

    const ledger = await store.readLedger(OWNER.id);
    const recorded = JSON.stringify(ledger);
    expect(recorded).toContain("sha256");
    expect(recorded).toContain("image/jpeg");
    // AD-3: opaque references and minimal facts only.
    expect(recorded).not.toContain("run a half marathon in april");
    expect(recorded).not.toContain("Do it.");
    expect(recorded).not.toContain(String(Array.from(JPEG)));
  });
});

describe("chapter and mission bonuses", () => {
  it("pays the chapter bonus once, on the step that finishes the chapter", async () => {
    const { complete } = await setup();
    await complete(0, 0);
    const finishing = await complete(0, 1);

    expect(finishing.awards).toEqual([
      { kind: "step", xp: 40 },
      { kind: "chapter", xp: 200 },
    ]);
    expect(finishing.progress.completedChapters).toEqual([{ missionId: "m-1", chapterIndex: 0 }]);
    // Repeating the finishing step does not pay the chapter again.
    expect((await complete(0, 1)).awards).toEqual([]);
  });

  it("pays the mission bonus once, when every chapter is done", async () => {
    const { complete } = await setup();
    await complete(0, 0);
    await complete(0, 1);
    await complete(1, 0);
    const last = await complete(1, 1);

    expect(last.awards).toEqual([
      { kind: "step", xp: 40 },
      { kind: "chapter", xp: 200 },
      { kind: "mission", xp: 800 },
    ]);
    // 4 steps x 40, 2 chapters x 200, mission 4 x 200.
    expect(last.progress.totalXp).toBe(160 + 400 + 800);
    expect(last.progress.completedMissions).toEqual(["m-1"]);
  });
});

describe("recovering from a failed write", () => {
  it("releases the claim when the ledger write fails, so a retry succeeds", async () => {
    const { ports } = await setup();
    let failNext = true;
    const flaky = {
      ...ports,
      ledger: {
        ...ports.ledger,
        append: async (ownerId: string, event: Parameters<typeof ports.ledger.append>[1]) => {
          if (failNext) {
            failNext = false;
            throw new Error("redis write failed at https://demo.upstash.io");
          }
          return ports.ledger.append(ownerId, event);
        },
      },
    };
    const attempt = () =>
      completeStep(
        { principal: OWNER, missionId: "m-1", chapterIndex: 0, stepIndex: 0, evidence: SELF },
        flaky,
      );

    expect((await failure(attempt)).code).toBe("STORE_UNAVAILABLE");
    // Without the release, the step would be marked taken with nothing paid.
    expect((await attempt()).awards).toEqual([{ kind: "step", xp: 40 }]);
  });
});
