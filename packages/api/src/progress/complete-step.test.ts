import type { MissionGoalContext } from "../ports";
import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it } from "vitest";
import type { GenerationSafetyClass, MissionDraft } from "../client";
import { demoPortsFromStore } from "../demo-store";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import type { StoredMissionDraft } from "../plan/ids";
import { fixedClock, sequentialIdGenerator } from "../ports";
import { completeStep, readProgress, type CompletionEvidenceInput } from "./complete-step";

const OWNER: GuestPrincipal = { id: "guest-1", createdAt: "2026-10-09T00:00:00.000Z" };
const INTRUDER: GuestPrincipal = { id: "guest-2", createdAt: "2026-10-09T00:00:00.000Z" };
const SELF: CompletionEvidenceInput = { kind: "SELF" };

/** The leading bytes of a real JPEG; enough for the sniffer. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

/**
 * Steps and missions here are stored exactly as the release before ids stored
 * them -- no ids -- so every test below also proves the upcaster keeps legacy
 * missions working.
 */
type LegacyStep = StoredMissionDraft["chapters"][number]["steps"][number];

function step(index: number, estimatedMinutes = 30): LegacyStep {
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
const MISSION: StoredMissionDraft = {
  title: "Half Marathon",
  goalType: "METRIC",
  primaryDomain: "Body",
  chapters: [
    { index: 0, title: "Base", exitCondition: "Run 5km", steps: [step(0), step(1)] },
    { index: 1, title: "Build", exitCondition: "Run 10km", steps: [step(0), step(1)] },
  ],
};

async function setup(mission: StoredMissionDraft = MISSION) {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: "2026-10-09T00:00:00.000Z",
    goalText: "run a half marathon in april",
    pursuitSlug: "run-a-half-marathon",
    // why: a legacy record, stored without ids, exactly as the old release wrote it.
    mission: mission as MissionDraft,
    safetyClass: "NORMAL",
  });
  const ports = {
    persistence: demo.persistence,
    ledger: demo.ledger,
    clock: fixedClock(new Date("2026-10-09T09:00:00.000Z")),
    ids: sequentialIdGenerator("event"),
  };
  const complete = (
    stepId: string,
    evidence: CompletionEvidenceInput = SELF,
    principal: GuestPrincipal = OWNER,
  ) => completeStep({ principal, missionId: "m-1", stepId, evidence }, ports);
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
    const result = await complete("0:0");

    expect(result.awards).toEqual([{ kind: "step", xp: 40 }]);
    expect(result.progress.totalXp).toBe(40);
    expect(result.progress.completions).toEqual([
      {
        missionId: "m-1",
        chapterId: "0",
        stepId: "0:0",
        evidence: "SELF",
        xp: 40,
        recordedAt: "2026-10-09T09:00:00.000Z",
      },
    ]);
  });

  it("pays a photo more than a self-check", async () => {
    const { complete } = await setup();
    const result = await complete("0:0", { kind: "ARTIFACT", bytes: JPEG });
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
    expect((await quick.complete("0:0")).awards).toEqual((await huge.complete("0:0")).awards);
  });

  it("treats a repeat as harmless: it pays nothing and changes nothing", async () => {
    const { complete } = await setup();
    await complete("0:0");
    const again = await complete("0:0");

    expect(again.awards).toEqual([]);
    expect(again.progress.totalXp).toBe(40);
    expect(again.progress.completions).toHaveLength(1);
  });

  it("pays a step once, however many requests race for it", async () => {
    const { complete } = await setup();
    const results = await Promise.all([complete("0:0"), complete("0:0"), complete("0:0")]);

    expect(results.flatMap((result) => result.awards)).toEqual([{ kind: "step", xp: 40 }]);
    expect((await complete("0:0")).progress.totalXp).toBe(40);
  });

  it("refuses to skip ahead, and records nothing when it does", async () => {
    const { complete, ports } = await setup();
    const error = await failure(() => complete("0:1"));
    expect(error.code).toBe("STEP_NOT_CURRENT");
    expect((await readProgress({ principal: OWNER }, ports)).completions).toEqual([]);
  });

  it("answers another guest's mission exactly as a missing one", async () => {
    const { complete } = await setup();
    const error = await failure(() => complete("0:0", SELF, INTRUDER));
    expect(error.code).toBe("MISSION_NOT_FOUND");
  });

  it("rejects a step id that is not in the mission", async () => {
    const { complete } = await setup();
    expect((await failure(() => complete("9:0"))).code).toBe("INVALID_REQUEST");
    expect((await failure(() => complete("0:9"))).code).toBe("INVALID_REQUEST");
    expect((await failure(() => complete("own-1"))).code).toBe("INVALID_REQUEST");
  });
});

describe("photo evidence", () => {
  it("rejects a file that is not a photo, without taking the step", async () => {
    const { complete } = await setup();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

    expect((await failure(() => complete("0:0", { kind: "ARTIFACT", bytes: svg }))).code).toBe(
      "EVIDENCE_REJECTED",
    );
    // The step was never claimed, so the person can still complete it.
    expect((await complete("0:0")).awards).toEqual([{ kind: "step", xp: 40 }]);
  });

  it("keeps a fingerprint in the ledger, never the photo or the goal", async () => {
    const { complete, store } = await setup();
    await complete("0:0", { kind: "ARTIFACT", bytes: JPEG });

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

describe("progression-v2 steps", () => {
  it("writes no chapter bonus, and leaves the chapter open for its boss", async () => {
    const { complete, store } = await setup();
    await complete("0:0");
    const finishing = await complete("0:1");

    expect(finishing.awards).toEqual([{ kind: "step", xp: 40 }]);
    expect(finishing.progress.completedChapters).toEqual([]);
    const ledger = (await store.readLedger(OWNER.id)) as { type: string; award?: unknown }[];
    expect(ledger.map((entry) => entry.type)).toEqual(["StepCompleted", "StepCompleted"]);
    expect(ledger[0]!.award).toMatchObject({ calculatorVersion: "progression-v2" });
    // The next chapter stays shut until the boss closes this one.
    expect((await failure(() => complete("1:0"))).code).toBe("STEP_NOT_CURRENT");
  });

  it("pays up to the per-chapter cap, then records further steps at 0", async () => {
    const long: StoredMissionDraft = {
      ...MISSION,
      chapters: [
        {
          index: 0,
          title: "Long",
          exitCondition: "Run 5km",
          steps: Array.from({ length: 11 }, (_unused, index) => step(index)),
        },
      ],
    };
    const { complete } = await setup(long);
    const paid: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      paid.push((await complete(`0:${index}`)).awards[0]!.xp);
    }
    // 40 x 11 would be 440: under the 450 cap, so every step pays in full.
    expect(paid.every((xp) => xp === 40)).toBe(true);

    const photos = await setup(long);
    const photoPaid: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const result = await photos.complete(`0:${index}`, { kind: "ARTIFACT", bytes: JPEG });
      photoPaid.push(result.awards[0]!.xp);
    }
    // 50 x 9 = 450 reaches the cap; the rest record 0.
    expect(photoPaid).toEqual([50, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0]);
    expect((await readProgress({ principal: OWNER }, photos.ports)).totalXp).toBe(450);
  });

  it("refuses a step left undone in a closed chapter: it was skipped for good", async () => {
    const { complete, store } = await setup();
    await complete("0:0");
    await store.appendLedger(OWNER.id, {
      version: 2,
      eventId: "boss-1",
      missionId: "m-1",
      recordedAt: "2026-10-09T10:00:00.000Z",
      type: "BossResolved",
      attemptId: "attempt-1",
      chapterId: "0",
      band: "done",
      evidence: { kind: "SELF" },
      xp: 400,
      selfDeclared: true,
      calculatorVersion: "progression-v2",
    });
    expect((await failure(() => complete("0:1"))).code).toBe("STEP_NOT_CURRENT");
    expect((await complete("1:0")).awards).toEqual([{ kind: "step", xp: 40 }]);
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
      completeStep({ principal: OWNER, missionId: "m-1", stepId: "0:0", evidence: SELF }, flaky);

    expect((await failure(attempt)).code).toBe("STORE_UNAVAILABLE");
    // Without the release, the step would be marked taken with nothing paid.
    expect((await attempt()).awards).toEqual([{ kind: "step", xp: 40 }]);
  });
});

describe("data from before stable ids", () => {
  const legacyEvent = (chapterIndex: number, stepIndex: number) => ({
    version: 1,
    eventId: `legacy-${chapterIndex}-${stepIndex}`,
    missionId: "m-1",
    recordedAt: "2026-10-08T09:00:00.000Z",
    type: "StepCompleted",
    chapterIndex,
    stepIndex,
    evidence: { kind: "SELF" },
    award: { xp: 40, base: 40, verificationMult: 1, calculatorVersion: "neutral-v1" },
  });

  it("keeps a legacy person's XP, completed steps and next step", async () => {
    const { store, complete, ports } = await setup();
    // What the old release left behind: a claim and a position-keyed event.
    await store.claimCompletion(OWNER.id, "m-1:step:0:0");
    await store.appendLedger(OWNER.id, legacyEvent(0, 0));

    const before = await readProgress({ principal: OWNER }, ports);
    expect(before.totalXp).toBe(40);
    expect(before.completions.map((entry) => entry.stepId)).toEqual(["0:0"]);

    // The next step is still the second one: skipping it is refused.
    expect((await failure(() => complete("1:0"))).code).toBe("STEP_NOT_CURRENT");
    const finishing = await complete("0:1");
    // Priced by progression-v2 now; the legacy event keeps its stored amount.
    expect(finishing.awards).toEqual([{ kind: "step", xp: 40 }]);
    expect(finishing.progress.totalXp).toBe(80);
  });

  it("keeps a chapter closed under neutral-v1 closed, and pays its mission once", async () => {
    const { store, complete, ports } = await setup();
    const meta = (eventId: string) => ({
      version: 1,
      eventId,
      missionId: "m-1",
      recordedAt: "2026-10-08T09:00:00.000Z",
    });
    await store.claimCompletion(OWNER.id, "m-1:step:0:0");
    await store.claimCompletion(OWNER.id, "m-1:step:0:1");
    await store.claimCompletion(OWNER.id, "m-1:chapter:0");
    await store.appendLedger(OWNER.id, legacyEvent(0, 0));
    await store.appendLedger(OWNER.id, legacyEvent(0, 1));
    await store.appendLedger(OWNER.id, {
      ...meta("legacy-c0"),
      type: "ChapterCompleted",
      chapterIndex: 0,
      xp: 200,
      calculatorVersion: "neutral-v1",
    });

    const before = await readProgress({ principal: OWNER }, ports);
    expect(before.totalXp).toBe(280);
    expect(before.completedChapters).toEqual([{ missionId: "m-1", chapterId: "0" }]);
    // The closed chapter is passed over: the next step is chapter 1's first.
    expect((await complete("1:0")).awards).toEqual([{ kind: "step", xp: 40 }]);
  });

  it("pays once for a step whose first attempt landed before the deploy", async () => {
    const { store, complete } = await setup();
    // The claim was taken under the legacy key; the retry arrives after.
    await store.claimCompletion(OWNER.id, "m-1:step:0:0");
    await store.appendLedger(OWNER.id, legacyEvent(0, 0));
    const retry = await complete("0:0");
    expect(retry.awards).toEqual([]);
    expect(retry.progress.totalXp).toBe(40);
  });
});
