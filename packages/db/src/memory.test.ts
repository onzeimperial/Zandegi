import { describe, expect, it } from "vitest";
import { createInMemoryDemoStore } from "./memory";
import { guestKey, missionKey, type StoredMission } from "./store";

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
