/**
 * What every `DemoStore` must do, written once and run against each store that
 * claims to be one. Passing here is what lets the in-memory twin stand in for
 * Postgres in the rest of the test suite.
 *
 * Owners are created through the store first, because Postgres enforces the
 * foreign key the twin has no reason to model.
 */

import { describe, expect, it } from "vitest";
import { MAX_LISTED_MISSIONS, type DemoStore, type StoredMission } from "./store";

let next = 0;
const unique = (prefix: string) => `${prefix}-${++next}`;
const CREATED_AT = "2026-11-04T01:02:03.456Z";
const DAY = "2026-11-04";

export function describeStoreContract(name: string, store: () => DemoStore): void {
  async function newOwner(): Promise<string> {
    const candidate = { id: unique("owner"), createdAt: CREATED_AT };
    const found = await store().findOrCreateAccountPrincipal(unique("clerk"), candidate);
    return found.id;
  }

  function mission(ownerId: string, overrides: Partial<StoredMission> = {}): StoredMission {
    return {
      missionId: unique("mission"),
      ownerId,
      runId: "run-1",
      generatedAt: CREATED_AT,
      goalText: "learn farsi",
      pursuitSlug: "learn-farsi",
      mission: { title: "Conversational Farsi", chapters: [{ index: 0, steps: [] }] },
      safetyClass: "NORMAL",
      ...overrides,
    };
  }

  describe(`${name}: the store contract`, () => {
    describe("missions", () => {
      it("returns the record it was given, with no invented goal context", async () => {
        const owner = await newOwner();
        const record = mission(owner);
        await store().recordMission(record);
        const found = await store().findMission(owner, record.missionId);
        expect(found).toEqual(record);
        expect(found).not.toHaveProperty("goalContext");
      });

      it("keeps the goal context when there is one", async () => {
        const owner = await newOwner();
        const goalContext = { location: "Melbourne", details: { why: "family" } };
        const record = mission(owner, { goalContext });
        await store().recordMission(record);
        expect(await store().findMission(owner, record.missionId)).toEqual(record);
      });

      it("answers null for another owner's mission and for an unknown id", async () => {
        const [owner, other] = [await newOwner(), await newOwner()];
        const record = mission(owner);
        await store().recordMission(record);
        expect(await store().findMission(other, record.missionId)).toBeNull();
        expect(await store().findMission(owner, "never-issued")).toBeNull();
      });

      it("lists one owner's missions, newest first", async () => {
        const [owner, other] = [await newOwner(), await newOwner()];
        const at = (minute: number) => `2026-11-04T01:0${minute}:00.000Z`;
        const old = mission(owner, { generatedAt: at(1) });
        const recent = mission(owner, { generatedAt: at(3) });
        const middle = mission(owner, { generatedAt: at(2) });
        for (const record of [old, recent, middle, mission(other)]) {
          await store().recordMission(record);
        }
        const listed = await store().listMissions(owner);
        expect(listed.map((entry) => entry.missionId)).toEqual([
          recent.missionId,
          middle.missionId,
          old.missionId,
        ]);
      });

      it("caps a listing", async () => {
        const owner = await newOwner();
        for (let index = 0; index <= MAX_LISTED_MISSIONS; index += 1) {
          await store().recordMission(mission(owner));
        }
        expect(await store().listMissions(owner)).toHaveLength(MAX_LISTED_MISSIONS);
      });
    });

    describe("guests", () => {
      it("finds a guest by token hash, and nothing for an unknown one", async () => {
        const hash = unique("hash");
        const guest = { id: unique("guest"), createdAt: CREATED_AT };
        await store().saveGuest(hash, guest);
        expect(await store().findGuest(hash)).toEqual(guest);
        expect(await store().findGuest(unique("hash"))).toBeNull();
      });

      it("treats renewing an unknown hash as a no-op", async () => {
        await expect(store().renewGuest(unique("hash"))).resolves.toBeUndefined();
      });
    });

    describe("account principals", () => {
      it("creates once and returns the same principal from then on", async () => {
        const clerk = unique("clerk");
        const first = { id: unique("owner"), createdAt: CREATED_AT };
        expect(await store().findOrCreateAccountPrincipal(clerk, first)).toEqual(first);
        const later = { id: unique("owner"), createdAt: "2027-01-01T00:00:00.000Z" };
        expect(await store().findOrCreateAccountPrincipal(clerk, later)).toEqual(first);
      });

      it("resolves requests racing for one user to one principal", async () => {
        const clerk = unique("clerk");
        const found = await Promise.all(
          Array.from({ length: 8 }, () =>
            store().findOrCreateAccountPrincipal(clerk, {
              id: unique("owner"),
              createdAt: CREATED_AT,
            }),
          ),
        );
        expect(new Set(found.map((entry) => entry.id)).size).toBe(1);
      });

      it("keeps two people apart", async () => {
        expect(await newOwner()).not.toBe(await newOwner());
      });
    });

    describe("generation slots", () => {
      it("grants up to the limit, then refuses", async () => {
        const owner = await newOwner();
        const results = [];
        for (let index = 0; index < 4; index += 1) {
          results.push(await store().claimGenerationSlot(owner, DAY, 3));
        }
        expect(results).toEqual([true, true, true, false]);
      });

      it("grants exactly the limit to requests racing for the last slots", async () => {
        const owner = await newOwner();
        const results = await Promise.all(
          Array.from({ length: 8 }, () => store().claimGenerationSlot(owner, DAY, 3)),
        );
        expect(results.filter(Boolean)).toHaveLength(3);
      });

      it("starts again the next day, and counts each person separately", async () => {
        const [owner, other] = [await newOwner(), await newOwner()];
        expect(await store().claimGenerationSlot(owner, DAY, 1)).toBe(true);
        expect(await store().claimGenerationSlot(owner, DAY, 1)).toBe(false);
        expect(await store().claimGenerationSlot(owner, "2026-11-05", 1)).toBe(true);
        expect(await store().claimGenerationSlot(other, DAY, 1)).toBe(true);
      });

      it("grants nothing when the limit is zero", async () => {
        expect(await store().claimGenerationSlot(await newOwner(), DAY, 0)).toBe(false);
      });
    });

    describe("completions", () => {
      it("lets exactly one racing claim win", async () => {
        const owner = await newOwner();
        const results = await Promise.all(
          Array.from({ length: 8 }, () => store().claimCompletion(owner, "0:0")),
        );
        expect(results.filter(Boolean)).toHaveLength(1);
      });

      it("allows a claim again after a release", async () => {
        const owner = await newOwner();
        expect(await store().claimCompletion(owner, "0:0")).toBe(true);
        await store().releaseCompletion(owner, "0:0");
        expect(await store().claimCompletion(owner, "0:0")).toBe(true);
      });

      it("scopes a claim to its owner", async () => {
        const [owner, other] = [await newOwner(), await newOwner()];
        expect(await store().claimCompletion(owner, "0:0")).toBe(true);
        expect(await store().claimCompletion(other, "0:0")).toBe(true);
      });
    });

    describe("the ledger", () => {
      it("reads back in append order, one owner at a time", async () => {
        const [owner, other] = [await newOwner(), await newOwner()];
        const entries = [{ n: 1, nested: { xp: 40 } }, { n: 2 }, { n: 3 }];
        for (const entry of entries) await store().appendLedger(owner, entry);
        await store().appendLedger(other, { n: 99 });
        expect(await store().readLedger(owner)).toEqual(entries);
      });

      it("reads empty for an owner with no entries", async () => {
        expect(await store().readLedger(await newOwner())).toEqual([]);
      });
    });
  });
}
