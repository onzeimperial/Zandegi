import { describe, expect, it } from "vitest";
import type { MissionDraft } from "../client";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import type { GeneratedMissionRecord, GenerationPersistencePort } from "../ports";
import { readMission } from "./read-mission";

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

async function failure(run: () => Promise<unknown>): Promise<GenerationError> {
  const caught = await run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(GenerationError);
  return caught as GenerationError;
}

describe("readMission", () => {
  it("returns the caller's own mission", async () => {
    const ports = { persistence: persistence([record()]) };

    const view = await readMission({ principal: OWNER, missionId: "mission-1" }, ports);

    expect(view).toEqual({
      missionId: "mission-1",
      generatedAt: "2026-10-07T00:00:00.000Z",
      pursuitSlug: "run-a-half-marathon",
      safetyClass: "NORMAL",
      mission: MISSION,
      version: 0,
    });
  });

  it("gives a mission stored before ids its position ids, and its version", async () => {
    const legacy = {
      ...MISSION,
      chapters: [
        {
          index: 0,
          title: "Base",
          exitCondition: "Four weeks",
          steps: [
            {
              index: 0,
              title: "Run",
              estimatedMinutes: 30,
              verification: "SELF" as const,
              guide: { approach: "Go.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
              sources: [],
              toolKinds: [],
            },
          ],
        },
      ],
    };
    // why: a record exactly as the release before ids stored it.
    const ports = {
      persistence: persistence([
        record({ mission: legacy as unknown as MissionDraft, version: 3 }),
      ]),
    };
    const view = await readMission({ principal: OWNER, missionId: "mission-1" }, ports);
    expect(view.mission.chapters[0]).toMatchObject({
      id: "0",
      steps: [{ id: "0:0", title: "Run" }],
    });
    expect(view.version).toBe(3);
  });

  it("keeps server-side record fields off the wire", async () => {
    const ports = { persistence: persistence([record()]) };

    const view = await readMission({ principal: OWNER, missionId: "mission-1" }, ports);

    for (const field of ["ownerId", "runId", "goalText"]) {
      expect(Object.keys(view), field).not.toContain(field);
    }
  });

  it.each([
    ["another principal's mission", INTRUDER, "mission-1"],
    ["an id that was never issued", OWNER, "mission-404"],
    ["a malformed id", OWNER, "../../etc/passwd"],
    ["an empty id", OWNER, ""],
  ])("answers not-found for %s", async (_label, principal, missionId) => {
    const ports = { persistence: persistence([record()]) };

    const error = await failure(() => readMission({ principal, missionId }, ports));

    // Identical code and message in every case: a caller cannot learn from the
    // response whether the mission exists.
    expect(error.code).toBe("MISSION_NOT_FOUND");
    expect(error.message).toBe("That mission is not available.");
  });

  it("answers not-found rather than invalid-request for a non-string id", async () => {
    const ports = { persistence: persistence([record()]) };

    for (const missionId of [undefined, null, 7, { id: "mission-1" }]) {
      const error = await failure(() => readMission({ principal: OWNER, missionId }, ports));
      expect(error.code).toBe("MISSION_NOT_FOUND");
    }
  });

  it("never reaches the store for an id it will not look up", async () => {
    let calls = 0;
    const ports = {
      persistence: {
        record: async () => undefined,
        findForOwner: async () => {
          calls += 1;
          return null;
        },
        listForOwner: async () => [],
      },
    };

    await failure(() => readMission({ principal: OWNER, missionId: "a/b" }, ports));
    expect(calls).toBe(0);
  });

  it("turns a store failure into a safe stable code with no credential in it", async () => {
    const ports = {
      persistence: {
        record: async () => undefined,
        findForOwner: async () => {
          throw new Error("ECONNREFUSED https://demo.upstash.io token=sk-super-secret-value");
        },
        listForOwner: async () => [],
      },
    };

    const error = await failure(() => readMission({ principal: OWNER, missionId: "m-1" }, ports));

    expect(error.code).toBe("STORE_UNAVAILABLE");
    expect(error.message).toBe("Your missions are temporarily unavailable. Try again.");
    expect(error.diagnostic).not.toContain("sk-super-secret-value");
  });
});
