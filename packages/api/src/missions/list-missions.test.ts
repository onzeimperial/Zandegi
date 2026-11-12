import { describe, expect, it } from "vitest";
import type { MissionDraft } from "../client";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import type { GeneratedMissionRecord, GenerationPersistencePort } from "../ports";
import { listMissions } from "./list-missions";

const OWNER: GuestPrincipal = { id: "guest-1", createdAt: "2026-10-07T00:00:00.000Z" };
const INTRUDER: GuestPrincipal = { id: "guest-2", createdAt: "2026-10-07T00:00:00.000Z" };

const MISSION: MissionDraft = {
  title: "Half Marathon",
  goalType: "METRIC",
  primaryDomain: "Body",
  chapters: [{ id: "0", index: 0, title: "Base building", exitCondition: "Four weeks", steps: [] }],
};

function record(overrides: Partial<GeneratedMissionRecord> = {}): GeneratedMissionRecord {
  return {
    missionId: "mission-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: "2026-10-07T00:00:00.000Z",
    goalText: "run a half marathon in april",
    pursuitSlug: "run-a-half-marathon",
    mission: MISSION,
    safetyClass: "NORMAL",
    ...overrides,
  };
}

function persistence(records: GeneratedMissionRecord[]): GenerationPersistencePort {
  return {
    record: async (entry) => {
      records.push(entry);
    },
    findForOwner: async (ownerId, missionId) =>
      records.find((entry) => entry.ownerId === ownerId && entry.missionId === missionId) ?? null,
    listForOwner: async (ownerId) => records.filter((entry) => entry.ownerId === ownerId),
  };
}

describe("listing a principal's missions", () => {
  it("returns the principal's missions as they come from the store", async () => {
    const records = [
      record({ missionId: "m-2", generatedAt: "2026-10-08T00:00:00.000Z" }),
      record({ missionId: "m-1" }),
    ];

    const listed = await listMissions({ principal: OWNER }, { persistence: persistence(records) });

    expect(listed.map((view) => view.missionId)).toEqual(["m-2", "m-1"]);
  });

  it("never returns another principal's missions", async () => {
    const records = [
      record({ missionId: "mine" }),
      record({ missionId: "theirs", ownerId: INTRUDER.id }),
    ];

    const listed = await listMissions({ principal: OWNER }, { persistence: persistence(records) });

    expect(listed.map((view) => view.missionId)).toEqual(["mine"]);
  });

  it("answers an empty list, not an error, for a principal with no missions", async () => {
    await expect(
      listMissions({ principal: OWNER }, { persistence: persistence([]) }),
    ).resolves.toEqual([]);
  });

  it("keeps server-side record fields off the wire", async () => {
    const [view] = await listMissions(
      { principal: OWNER },
      { persistence: persistence([record()]) },
    );

    // The goal text is the user's own words; ownerId and runId are internal.
    expect(Object.keys(view!).sort()).toEqual(
      ["generatedAt", "mission", "missionId", "pursuitSlug", "safetyClass", "version"].sort(),
    );
    expect(JSON.stringify(view)).not.toContain("run a half marathon in april");
  });

  it("turns a store failure into a safe stable code with no credential in it", async () => {
    const caught = await listMissions(
      { principal: OWNER },
      {
        persistence: {
          record: async () => undefined,
          findForOwner: async () => null,
          listForOwner: async () => {
            throw new Error("ECONNREFUSED https://demo.upstash.io token=sk-super-secret-value");
          },
        },
      },
    ).then(
      () => null,
      (error: unknown) => error,
    );

    expect(caught).toBeInstanceOf(GenerationError);
    expect((caught as GenerationError).code).toBe("STORE_UNAVAILABLE");
  });
});

describe("listing missions stored before ids", () => {
  it("gives them position ids and version 0", async () => {
    const step = (index: number) => ({
      index,
      title: `Step ${index + 1}`,
      estimatedMinutes: 30,
      verification: "SELF" as const,
      guide: { approach: "Go.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
      sources: [],
      toolKinds: [],
    });
    const legacy = {
      title: "Half Marathon",
      goalType: "METRIC" as const,
      primaryDomain: "Body" as const,
      chapters: [
        { index: 0, title: "Base", exitCondition: "5km", steps: [step(0), step(1)] },
        { index: 1, title: "Build", exitCondition: "10km", steps: [step(0)] },
      ],
    };
    const stored = record({ mission: legacy as unknown as MissionDraft });
    delete stored.version;

    const [view] = await listMissions({ principal: OWNER }, { persistence: persistence([stored]) });

    expect(view!.version).toBe(0);
    expect(view!.mission.chapters.map((chapter) => chapter.id)).toEqual(["0", "1"]);
    expect(view!.mission.chapters.map((chapter) => chapter.steps.map((s) => s.id))).toEqual([
      ["0:0", "0:1"],
      ["1:0"],
    ]);
  });
});
