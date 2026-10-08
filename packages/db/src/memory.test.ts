import { describe, expect, it } from "vitest";
import { createInMemoryDemoStore } from "./memory";
import { MAX_LISTED_MISSIONS, guestKey, missionKey, type StoredMission } from "./store";

const NOW = Date.UTC(2026, 9, 7);
const WINDOW = 60;

function mission(overrides: Partial<StoredMission> = {}): StoredMission {
  return {
    missionId: "m-1",
    ownerId: "guest-1",
    runId: "run-1",
    generatedAt: new Date(NOW).toISOString(),
    goalText: "learn farsi",
    pursuitSlug: "learn-farsi",
    mission: { title: "Conversational Farsi" },
    safetyClass: "NORMAL",
    ...overrides,
  };
}

describe("the in-memory demo store", () => {
  it("reads a mission back by its owner and its id together", async () => {
    const store = createInMemoryDemoStore();
    await store.recordMission(mission());

    await expect(store.findMission("guest-1", "m-1")).resolves.toMatchObject({ missionId: "m-1" });
  });

  it("answers null for another principal's mission and for an unknown id", async () => {
    const store = createInMemoryDemoStore();
    await store.recordMission(mission());

    await expect(store.findMission("guest-2", "m-1")).resolves.toBeNull();
    await expect(store.findMission("guest-1", "m-404")).resolves.toBeNull();
  });

  it("keys on the owner and the id, so an ownership-checked read is one lookup", () => {
    // The owner is part of the key rather than a field compared afterwards,
    // which is what makes "not found" and "not yours" the same operation.
    expect(missionKey("guest-1", "m-1")).toBe("zandegi:demo:mission:guest-1:m-1");
    expect(guestKey("abc123")).toBe("zandegi:demo:guest:abc123");
  });

  it("does not hand out a reference a caller can mutate", async () => {
    const store = createInMemoryDemoStore();
    const record = mission();
    await store.recordMission(record);

    record.ownerId = "guest-2";
    const first = await store.findMission("guest-1", "m-1");
    first!.pursuitSlug = "tampered";

    await expect(store.findMission("guest-1", "m-1")).resolves.toMatchObject({
      ownerId: "guest-1",
      pursuitSlug: "learn-farsi",
    });
  });

  it("stores and renews a guest by its token hash", async () => {
    let clock = NOW;
    const store = createInMemoryDemoStore({ retentionSeconds: WINDOW, now: () => clock });
    await store.saveGuest("hash-a", { id: "guest-1", createdAt: new Date(NOW).toISOString() });

    clock += (WINDOW - 1) * 1000;
    await store.renewGuest("hash-a");

    clock += (WINDOW - 1) * 1000;
    await expect(store.findGuest("hash-a")).resolves.toMatchObject({ id: "guest-1" });
  });

  it("lets a record lapse once its window passes", async () => {
    let clock = NOW;
    const store = createInMemoryDemoStore({ retentionSeconds: WINDOW, now: () => clock });
    await store.saveGuest("hash-a", { id: "guest-1", createdAt: new Date(NOW).toISOString() });
    await store.recordMission(mission());

    clock += (WINDOW + 1) * 1000;

    await expect(store.findGuest("hash-a")).resolves.toBeNull();
    await expect(store.findMission("guest-1", "m-1")).resolves.toBeNull();
    // A lapsed mission must not linger in the owner's list either. Reading the
    // list is also what lets the lapsed index entry itself drop.
    await expect(store.listMissions("guest-1")).resolves.toEqual([]);
    // Lapsed entries are dropped as they are read, not swept on a schedule.
    expect(store.size()).toBe(0);
  });

  it("renews a mission's window when its owner reads it", async () => {
    let clock = NOW;
    const store = createInMemoryDemoStore({ retentionSeconds: WINDOW, now: () => clock });
    await store.recordMission(mission());

    clock += (WINDOW - 1) * 1000;
    await expect(store.findMission("guest-1", "m-1")).resolves.not.toBeNull();

    clock += (WINDOW - 1) * 1000;
    await expect(store.findMission("guest-1", "m-1")).resolves.not.toBeNull();
  });

  it("stays silent when asked to renew a hash it has never seen", async () => {
    const store = createInMemoryDemoStore();
    await expect(store.renewGuest("hash-unknown")).resolves.toBeUndefined();
    expect(store.size()).toBe(0);
  });
});

describe("listing a guest's missions", () => {
  const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

  it("lists the owner's missions newest first", async () => {
    const store = createInMemoryDemoStore();
    await store.recordMission(mission({ missionId: "old", generatedAt: at(0) }));
    await store.recordMission(mission({ missionId: "new", generatedAt: at(10) }));
    await store.recordMission(mission({ missionId: "mid", generatedAt: at(5) }));

    const listed = await store.listMissions("guest-1");
    expect(listed.map((entry) => entry.missionId)).toEqual(["new", "mid", "old"]);
  });

  it("never lists another guest's missions", async () => {
    const store = createInMemoryDemoStore();
    await store.recordMission(mission({ missionId: "mine", ownerId: "guest-1" }));
    await store.recordMission(mission({ missionId: "theirs", ownerId: "guest-2" }));

    expect((await store.listMissions("guest-1")).map((m) => m.missionId)).toEqual(["mine"]);
    expect((await store.listMissions("guest-2")).map((m) => m.missionId)).toEqual(["theirs"]);
    await expect(store.listMissions("guest-3")).resolves.toEqual([]);
  });

  it("caps the list so one guest cannot grow it forever", async () => {
    const store = createInMemoryDemoStore();
    for (let i = 0; i < MAX_LISTED_MISSIONS + 5; i++) {
      await store.recordMission(mission({ missionId: `m-${i}`, generatedAt: at(i) }));
    }
    const listed = await store.listMissions("guest-1");
    expect(listed).toHaveLength(MAX_LISTED_MISSIONS);
    // The newest survive the cap, not the oldest.
    expect(listed[0]!.missionId).toBe(`m-${MAX_LISTED_MISSIONS + 4}`);
  });

  it("records the same mission once even if it is written twice", async () => {
    const store = createInMemoryDemoStore();
    await store.recordMission(mission());
    await store.recordMission(mission());
    await expect(store.listMissions("guest-1")).resolves.toHaveLength(1);
  });

  it("returns copies, so a caller cannot mutate the store through a listing", async () => {
    const store = createInMemoryDemoStore();
    await store.recordMission(mission());
    const [listed] = await store.listMissions("guest-1");
    (listed!.mission as { title: string }).title = "tampered";
    const [again] = await store.listMissions("guest-1");
    expect((again!.mission as { title: string }).title).toBe("Conversational Farsi");
  });
});

describe("completion claims and the ledger", () => {
  it("lets exactly one caller claim a completion", async () => {
    const store = createInMemoryDemoStore();
    const results = await Promise.all([
      store.claimCompletion("guest-1", "m-1:0:0"),
      store.claimCompletion("guest-1", "m-1:0:0"),
      store.claimCompletion("guest-1", "m-1:0:0"),
    ]);
    // A double-tap or a retry must never pay a step twice.
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("scopes a claim to its owner", async () => {
    const store = createInMemoryDemoStore();
    await expect(store.claimCompletion("guest-1", "m-1:0:0")).resolves.toBe(true);
    await expect(store.claimCompletion("guest-2", "m-1:0:0")).resolves.toBe(true);
  });

  it("frees a released claim so a failed completion can be retried", async () => {
    const store = createInMemoryDemoStore();
    await store.claimCompletion("guest-1", "m-1:0:0");
    await store.releaseCompletion("guest-1", "m-1:0:0");
    await expect(store.claimCompletion("guest-1", "m-1:0:0")).resolves.toBe(true);
  });

  it("keeps the ledger in append order, separately for each guest", async () => {
    const store = createInMemoryDemoStore();
    await store.appendLedger("guest-1", { n: 1 });
    await store.appendLedger("guest-2", { n: 99 });
    await store.appendLedger("guest-1", { n: 2 });

    await expect(store.readLedger("guest-1")).resolves.toEqual([{ n: 1 }, { n: 2 }]);
    await expect(store.readLedger("guest-2")).resolves.toEqual([{ n: 99 }]);
    await expect(store.readLedger("guest-3")).resolves.toEqual([]);
  });

  it("never edits an entry: an earlier read is unaffected by later appends", async () => {
    const store = createInMemoryDemoStore();
    await store.appendLedger("guest-1", { n: 1 });
    const before = await store.readLedger("guest-1");
    await store.appendLedger("guest-1", { n: 2 });
    (before[0] as { n: number }).n = 42;

    expect(before).toHaveLength(1);
    await expect(store.readLedger("guest-1")).resolves.toEqual([{ n: 1 }, { n: 2 }]);
  });
});
