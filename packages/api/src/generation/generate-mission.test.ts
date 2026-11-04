import { describe, expect, it, vi } from "vitest";
import type { MissionDraftOutcome, ModelOutputRejection } from "@zandegi/ai";
import { GENERATION_STAGES, type GenerationProgress, type GenerationResult } from "../client";
import { GenerationError } from "../errors";
import {
  cancellationFrom,
  emptyKnowledge,
  fixedClock,
  sequentialIdGenerator,
  type GeneratedMissionRecord,
  type GenerateMissionPorts,
  type GuestPrincipal,
  type KnowledgePort,
} from "../index";
import { generateMission, type MissionDraftGenerator } from "./generate-mission";

const START = new Date("2026-10-06T01:00:00.000Z");
const GOAL = "run a half marathon in april";
const OWNER: GuestPrincipal = { id: "guest-1", createdAt: START.toISOString() };

function draftOutcome(): MissionDraftOutcome {
  return {
    draft: {
      goalText: GOAL,
      pursuitSlug: "run-a-half-marathon",
      mission: {
        title: "Half Marathon",
        goalType: "METRIC",
        primaryDomain: "Body",
        chapters: [
          {
            index: 0,
            title: "Base building",
            exitCondition: "Run 3x a week for four weeks",
            steps: [
              {
                index: 0,
                title: "Run 3km easy",
                estimatedMinutes: 30,
                verification: "TIMER",
                guide: {
                  approach: "Jog at a conversational pace.",
                  materials: [],
                  commonMistakes: [],
                  whatGoodLooksLike: "You finish able to talk.",
                },
                sources: [],
                toolKinds: [],
              },
            ],
          },
        ],
      },
      grounding: { claimsChecked: 4, ungroundedClaims: [], rewritten: 1, dropped: 0 },
      safety: {
        safetyClass: "NORMAL",
        blocked: false,
        professionalFrameApplied: false,
        redactions: ["1200 kcal"],
      },
      modelsUsed: { interpret: "test-model" },
    },
  };
}

/** Walks every key of a value, however deeply nested. */
function allKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      found.push(key);
      allKeys(child, found);
    }
  }
  return found;
}

type TestPorts = GenerateMissionPorts & { records: GeneratedMissionRecord[] };

function ports(overrides: Partial<GenerateMissionPorts> = {}): TestPorts {
  const records: GeneratedMissionRecord[] = [];
  return {
    clock: fixedClock(START),
    ids: sequentialIdGenerator("run"),
    cancellation: cancellationFrom(new AbortController().signal),
    knowledge: emptyKnowledge,
    persistence: {
      record: async (record) => {
        records.push(record);
      },
      findForOwner: async (ownerId, missionId) =>
        records.find((record) => record.ownerId === ownerId && record.missionId === missionId) ??
        null,
      listForOwner: async (ownerId) => records.filter((record) => record.ownerId === ownerId),
    },
    draftGenerator: async () => draftOutcome(),
    records,
    ...overrides,
  };
}

describe("generateMission rejection reporting", () => {
  it("forwards rejections with the person's goal redacted from any received value", async () => {
    const reported: ModelOutputRejection[] = [];
    const deps = ports({
      draftGenerator: async (_input, _onEvent, options) => {
        options.onOutputRejected?.({
          stage: "detail",
          attempt: 1,
          willRetry: false,
          kind: "schema_mismatch",
          model: "m",
          issues: [
            { path: "steps.0.verification", code: "invalid_value", received: `"${GOAL}"` },
            { path: "steps.1.title", code: "too_small" },
          ],
        });
        throw new Error("rejected");
      },
      onOutputRejected: (rejection) => reported.push(rejection),
    });

    await generateMission({ request: { rawText: GOAL }, principal: OWNER }, deps).catch(
      () => undefined,
    );

    expect(reported).toHaveLength(1);
    expect(JSON.stringify(reported)).not.toContain(GOAL);
    expect(reported[0]?.issues[0]?.received).toContain("[redacted]");
    expect(reported[0]?.issues[1]).toEqual({ path: "steps.1.title", code: "too_small" });
  });
});

describe("generateMission use case", () => {
  it("returns a client-safe mission result with no progression number anywhere", async () => {
    const progress: GenerationProgress[] = [];
    const deps = ports({
      draftGenerator: async (_input, onEvent) => {
        onEvent?.({ stage: "interpret", status: "start" });
        onEvent?.({
          stage: "detail",
          status: "done",
          chapter: draftOutcome().draft!.mission.chapters[0]!,
        });
        return draftOutcome();
      },
    });

    const result = await generateMission(
      { request: { rawText: GOAL }, principal: OWNER, onProgress: (entry) => progress.push(entry) },
      deps,
    );

    expect(result.outcome).toBe("mission");
    const keys = allKeys(result).map((key) => key.toLowerCase());
    for (const forbidden of ["basexp", "completionxp", "xp", "rarity", "difficulty", "priority"]) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    expect(JSON.stringify(result)).not.toContain("MissionGenerated");

    if (result.outcome !== "mission") throw new Error("unreachable");
    expect(result.mission.chapters[0]?.steps[0]?.estimatedMinutes).toBe(30);
    expect(result.grounding).toEqual({
      claimsChecked: 4,
      ungroundedClaims: 0,
      rewritten: 1,
      dropped: 0,
    });
    // Redactions and the blocked flag are server diagnostics, not client content.
    expect(result.safety).toEqual({ safetyClass: "NORMAL", professionalFrameApplied: false });
    expect(progress.map((entry) => entry.stage)).toEqual(["interpret", "detail"]);
    expect(progress[1]?.chapter?.steps[0]?.title).toBe("Run 3km easy");
    expect(allKeys(progress)).not.toContain("baseXp");
    expect(GENERATION_STAGES as readonly string[]).not.toContain("score");
  });

  it("takes its run id, timestamps and evaluation instant from the injected ports", async () => {
    const knowledge: KnowledgePort = { resolve: vi.fn(async () => []) };
    const ticks = [START, new Date(START.getTime() + 4_200)];
    const seenOptions: { asOf: Date }[] = [];
    const deps = ports({
      knowledge,
      clock: { now: () => ticks.shift() ?? new Date(START.getTime() + 4_200) },
      draftGenerator: async (_input, _onEvent, options) => {
        seenOptions.push(options);
        return draftOutcome();
      },
    });

    const result = await generateMission({ request: { rawText: GOAL }, principal: OWNER }, deps);

    expect(result.meta).toEqual({
      runId: "run-1",
      startedAt: "2026-10-06T01:00:00.000Z",
      completedAt: "2026-10-06T01:00:04.200Z",
      durationMs: 4_200,
    });
    expect(knowledge.resolve).toHaveBeenCalledWith({ slots: [], asOf: START });
    // The same instant reaches generation, so every freshness decision in a run
    // is judged against one moment and `ai` never reads an ambient clock.
    expect(seenOptions).toHaveLength(1);
    expect(seenOptions[0]?.asOf).toBe(START);
  });

  it("stores the accepted mission against its owner and creates no ledger fact", async () => {
    const deps = ports();
    const result = await generateMission({ request: { rawText: GOAL }, principal: OWNER }, deps);

    expect(deps.records).toHaveLength(1);
    const stored = deps.records[0]!;
    expect(stored).toMatchObject({
      runId: "run-1",
      ownerId: "guest-1",
      pursuitSlug: "run-a-half-marathon",
      generatedAt: "2026-10-06T01:00:00.000Z",
    });
    // The mission id is server-assigned, from the same id port as the run id,
    // and the terminal frame carries exactly the stored id.
    expect(stored.missionId).toBe("run-2");
    if (result.outcome !== "mission") throw new Error("unreachable");
    expect(result.missionId).toBe(stored.missionId);
    // Relational record, not a ledger fact.
    expect(Object.keys(stored)).not.toContain("type");
    expect(Object.keys(stored)).not.toContain("occurredAt");
    expect(JSON.stringify(stored)).not.toContain("MissionGenerated");
  });

  it("stores the client-safe draft, so no provider payload reaches the store", async () => {
    const deps = ports();
    await generateMission({ request: { rawText: GOAL }, principal: OWNER }, deps);

    const stored = deps.records[0]!;
    expect(stored.mission.chapters[0]?.steps[0]?.title).toBe("Run 3km easy");
    expect(JSON.stringify(stored)).not.toContain("modelsUsed");
    expect(JSON.stringify(stored)).not.toContain("redactions");
  });

  it("is readable afterwards by its owner and by nobody else", async () => {
    const deps = ports();
    const result = await generateMission({ request: { rawText: GOAL }, principal: OWNER }, deps);
    if (result.outcome !== "mission") throw new Error("unreachable");

    await expect(deps.persistence.findForOwner(OWNER.id, result.missionId)).resolves.toMatchObject({
      missionId: result.missionId,
    });
    await expect(deps.persistence.findForOwner("guest-2", result.missionId)).resolves.toBeNull();
  });

  it("fails the request when the store cannot keep the mission", async () => {
    const deps = ports({
      persistence: {
        record: async () => {
          throw new Error(`redis write failed for "${GOAL}" at https://demo.upstash.io`);
        },
        findForOwner: async () => null,
        listForOwner: async () => [],
      },
    });

    const error = (await generateMission(
      { request: { rawText: GOAL }, principal: OWNER },
      deps,
    ).catch((caught: unknown) => caught)) as GenerationError;

    expect(error).toBeInstanceOf(GenerationError);
    expect(error.code).toBe("STORE_UNAVAILABLE");
    expect(error.message).toBe("Your missions are temporarily unavailable. Try again.");
    // The user's words never reach a diagnostic, here or anywhere else.
    expect(error.diagnostic).not.toContain(GOAL);
  });

  it("passes a refusal through with its route and no mission content", async () => {
    const deps = ports({
      draftGenerator: async () => ({
        draft: null,
        refusal: { reason: "This needs a person, not a mission.", route: "support" as const },
      }),
    });

    const result: GenerationResult = await generateMission(
      { request: { rawText: "i want to die less" }, principal: OWNER },
      deps,
    );

    expect(result).toMatchObject({ outcome: "refusal", refusal: { route: "support" } });
    expect(JSON.stringify(result)).not.toContain("chapters");
    expect(deps.records).toHaveLength(0);
  });

  it.each([
    ["a non-object body", "not-a-body"],
    ["an unknown field", { rawText: "run", extra: true }],
    ["a blank goal", { rawText: "   " }],
    ["an oversized goal", { rawText: "x".repeat(2_001) }],
    ["a bad timezone", { rawText: "run", timezone: "not/a-zone" }],
    ["a fractional time budget", { rawText: "run", weeklyTimeBudgetMinutes: 1.5 }],
  ])("rejects %s before calling the pipeline", async (_label, request) => {
    const draftGenerator = vi.fn<MissionDraftGenerator>();
    const deps = ports({ draftGenerator });

    await expect(generateMission({ request, principal: OWNER }, deps)).rejects.toMatchObject({
      name: "GenerationError",
      code: "INVALID_REQUEST",
      message: "The request fields are invalid.",
    });
    expect(draftGenerator).not.toHaveBeenCalled();
    expect(deps.records).toHaveLength(0);
  });

  it("aborts through the injected signal and produces no terminal result", async () => {
    const controller = new AbortController();
    let pipelineSignal: AbortSignal | undefined;
    const progress: GenerationProgress[] = [];
    const deps = ports({
      cancellation: cancellationFrom(controller.signal),
      draftGenerator: (_input, onEvent, options) =>
        new Promise((_resolve, reject) => {
          pipelineSignal = options?.signal;
          options?.signal?.addEventListener(
            "abort",
            () => {
              onEvent?.({ stage: "plan", status: "error" });
              reject(options.signal!.reason);
            },
            { once: true },
          );
        }),
    });

    const pending = generateMission(
      { request: { rawText: GOAL }, principal: OWNER, onProgress: (entry) => progress.push(entry) },
      deps,
    );
    // Let the use case reach the pipeline before the client goes away.
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort(new DOMException("Client disconnected", "AbortError"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(pipelineSignal).toBe(controller.signal);
    // Nothing is emitted or persisted once the client is gone.
    expect(progress).toHaveLength(0);
    expect(deps.records).toHaveLength(0);
  });

  it("refuses to start when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("Client disconnected", "AbortError"));
    const draftGenerator = vi.fn<MissionDraftGenerator>();

    await expect(
      generateMission(
        { request: { rawText: "run" }, principal: OWNER },
        ports({ cancellation: cancellationFrom(controller.signal), draftGenerator }),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(draftGenerator).not.toHaveBeenCalled();
  });

  it("turns an internal failure into a stable code and keeps the detail server-side", async () => {
    const deps = ports({
      draftGenerator: async () => {
        throw new Error(`stage detail failed for "${GOAL}" with key sk-ant-secret123456`);
      },
    });

    const error = await generateMission(
      { request: { rawText: GOAL }, principal: OWNER },
      deps,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GenerationError);
    const failure = error as GenerationError;
    expect(failure.code).toBe("GENERATION_FAILED");
    expect(failure.message).toBe("Mission generation failed. Try again.");
    // The diagnostic survives for the server log, with personal content and
    // anything key-shaped redacted.
    expect(failure.diagnostic).toContain("stage detail failed");
    expect(failure.diagnostic).not.toContain(GOAL);
    expect(failure.diagnostic).not.toContain("sk-ant-secret123456");
    expect(deps.records).toHaveLength(0);
  });

  it("redacts a one-character goal, which the request validator accepts", async () => {
    const deps = ports({
      draftGenerator: async () => {
        throw new Error("stage detail failed for x");
      },
    });

    const failure = (await generateMission(
      { request: { rawText: "x" }, principal: OWNER },
      deps,
    ).catch((caught: unknown) => caught)) as GenerationError;

    expect(failure.diagnostic).toContain("[redacted]");
    expect(failure.diagnostic).not.toMatch(/\bx\b/);
  });

  it("fails closed when the pipeline returns neither a draft nor a refusal", async () => {
    const deps = ports({ draftGenerator: async () => ({ draft: null }) });
    await expect(
      generateMission({ request: { rawText: "run" }, principal: OWNER }, deps),
    ).rejects.toMatchObject({
      code: "GENERATION_FAILED",
    });
  });
});
