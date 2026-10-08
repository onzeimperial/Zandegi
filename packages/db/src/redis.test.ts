import { describe, expect, it } from "vitest";
import { createRedisDemoStore, type RedisLike } from "./redis";
import {
  StoreUnavailableError,
  guestKey,
  missionKey,
  ownerIndexKey,
  type StoredMission,
} from "./store";

const URL = "https://demo-12345.upstash.io";
const TOKEN = "AX9zASQgYTEyMzQ1Njc4OTBhYmNkZWY";
const WINDOW = 1_234;

interface Call {
  op: "get" | "set" | "expire" | "del" | "rpush" | "lrange";
  key: string;
  ex?: number;
}

function fakeRedis(options: { data?: Record<string, string>; fail?: boolean } = {}) {
  const data = new Map(Object.entries(options.data ?? {}));
  const lists = new Map<string, string[]>();
  const calls: Call[] = [];
  const client: RedisLike = {
    async get(key) {
      calls.push({ op: "get", key });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/get (Bearer ${TOKEN})`);
      return data.get(key) ?? null;
    },
    async set(key, value, opts) {
      calls.push({ op: "set", key, ex: opts.ex });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/set (Bearer ${TOKEN})`);
      // Honour NX the way Redis does, or a claim test would prove nothing.
      if (opts.nx === true && data.has(key)) return null;
      data.set(key, value);
      return "OK";
    },
    async expire(key, seconds) {
      calls.push({ op: "expire", key, ex: seconds });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/expire (Bearer ${TOKEN})`);
      return data.has(key) || lists.has(key) ? 1 : 0;
    },
    async del(key) {
      calls.push({ op: "del", key });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/del (Bearer ${TOKEN})`);
      return data.delete(key) ? 1 : 0;
    },
    async rpush(key, value) {
      calls.push({ op: "rpush", key });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/rpush (Bearer ${TOKEN})`);
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    },
    async lrange(key, start, stop) {
      calls.push({ op: "lrange", key });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/lrange (Bearer ${TOKEN})`);
      return (lists.get(key) ?? []).slice(start, stop + 1);
    },
  };
  return { client, calls, data };
}

function store(fake: ReturnType<typeof fakeRedis>) {
  return createRedisDemoStore({
    client: fake.client,
    retentionSeconds: WINDOW,
    secrets: [URL, TOKEN],
  });
}

const RECORD: StoredMission = {
  missionId: "m-1",
  ownerId: "guest-1",
  runId: "run-1",
  generatedAt: "2026-10-07T00:00:00.000Z",
  goalText: "learn farsi",
  pursuitSlug: "learn-farsi",
  mission: { title: "Conversational Farsi" },
  safetyClass: "NORMAL",
};

describe("the Redis demo store", () => {
  it("writes every value with the retention window as a TTL", async () => {
    const fake = fakeRedis();
    await store(fake).recordMission(RECORD);
    await store(fake).saveGuest("hash-a", { id: "guest-1", createdAt: RECORD.generatedAt });

    // The TTL *is* the cleanup: there is no sweep job to schedule. That includes
    // the owner index -- written without a TTL it would quietly live forever.
    expect(fake.calls).toEqual([
      { op: "set", key: missionKey("guest-1", "m-1"), ex: WINDOW },
      { op: "get", key: ownerIndexKey("guest-1") },
      { op: "set", key: ownerIndexKey("guest-1"), ex: WINDOW },
      { op: "set", key: guestKey("hash-a"), ex: WINDOW },
    ]);
    for (const call of fake.calls.filter((entry) => entry.op === "set")) {
      expect(call.ex, call.key).toBe(WINDOW);
    }
  });

  it("reads a mission with one keyed lookup and no scan", async () => {
    const fake = fakeRedis({ data: { [missionKey("guest-1", "m-1")]: JSON.stringify(RECORD) } });

    await expect(store(fake).findMission("guest-1", "m-1")).resolves.toEqual(RECORD);
    await expect(store(fake).findMission("guest-2", "m-1")).resolves.toBeNull();

    expect(fake.calls.map((call) => call.op)).toEqual(["get", "expire", "get"]);
    expect(fake.calls.filter((call) => call.op === "expire")[0]).toEqual({
      op: "expire",
      key: missionKey("guest-1", "m-1"),
      ex: WINDOW,
    });
  });

  it("accepts a value the client has already deserialised", async () => {
    const fake = fakeRedis();
    fake.data.set(guestKey("hash-a"), { id: "guest-1", createdAt: "x" } as unknown as string);

    await expect(store(fake).findGuest("hash-a")).resolves.toEqual({
      id: "guest-1",
      createdAt: "x",
    });
  });

  it("renews a guest with expire, which is a no-op for an unknown hash", async () => {
    const fake = fakeRedis();
    await store(fake).renewGuest("hash-unknown");

    expect(fake.calls).toEqual([{ op: "expire", key: guestKey("hash-unknown"), ex: WINDOW }]);
  });

  it("never lets the endpoint or the token into a failure", async () => {
    const fake = fakeRedis({ fail: true });

    const error = await store(fake)
      .recordMission(RECORD)
      .then(
        () => null,
        (caught: unknown) => caught as StoreUnavailableError,
      );

    expect(error).toBeInstanceOf(StoreUnavailableError);
    expect(error!.operation).toBe("recordMission");
    expect(error!.detail).not.toContain("upstash.io");
    expect(error!.detail).not.toContain(TOKEN);
    expect(error!.detail).toContain("[redacted]");
    // No `cause`, so nothing unsanitised rides along behind the message.
    expect(error!.cause).toBeUndefined();
    expect(error!.message).toBe("store unavailable: recordMission");
  });

  it("still returns the mission when only the TTL renewal fails", async () => {
    const data = { [missionKey("guest-1", "m-1")]: JSON.stringify(RECORD) };
    const calls: Call[] = [];
    const client: RedisLike = {
      async get(key) {
        calls.push({ op: "get", key });
        return data[key] ?? null;
      },
      async set() {
        return "OK";
      },
      async expire() {
        throw new Error(`fetch failed: POST ${URL}/expire`);
      },
      async del() {
        return 0;
      },
      async rpush() {
        return 1;
      },
      async lrange() {
        return [];
      },
    };

    await expect(
      createRedisDemoStore({ client, retentionSeconds: WINDOW, secrets: [URL, TOKEN] }).findMission(
        "guest-1",
        "m-1",
      ),
    ).resolves.toEqual(RECORD);
  });

  it("treats an unparseable stored value as absent rather than throwing", async () => {
    const fake = fakeRedis({ data: { [guestKey("hash-a")]: "{not json" } });

    await expect(store(fake).findGuest("hash-a")).resolves.toBeNull();
  });
});

describe("listing a guest's missions from Redis", () => {
  it("reads the owner's index then each mission by key, newest first, never scanning", async () => {
    const newer = { ...RECORD, missionId: "m-2", generatedAt: "2026-10-08T00:00:00.000Z" };
    const fake = fakeRedis();
    await store(fake).recordMission(RECORD);
    await store(fake).recordMission(newer);
    fake.calls.length = 0;

    const listed = await store(fake).listMissions("guest-1");

    expect(listed.map((entry) => entry.missionId)).toEqual(["m-2", "m-1"]);
    // Only keyed operations: the index, each mission, then renewing the index.
    expect(fake.calls.map((call) => call.op)).toEqual(["get", "get", "get", "expire"]);
    expect(fake.calls[0]).toEqual({ op: "get", key: ownerIndexKey("guest-1") });
  });

  it("skips a mission that has expired out from under its index entry", async () => {
    const fake = fakeRedis();
    await store(fake).recordMission(RECORD);
    // Redis expired the mission, but the index still names it.
    fake.data.delete(missionKey("guest-1", "m-1"));

    await expect(store(fake).listMissions("guest-1")).resolves.toEqual([]);
  });

  it("never lists another guest's missions", async () => {
    const fake = fakeRedis();
    await store(fake).recordMission(RECORD);
    await expect(store(fake).listMissions("guest-2")).resolves.toEqual([]);
  });

  it("keeps credentials out of a listing failure", async () => {
    const error = await store(fakeRedis({ fail: true }))
      .listMissions("guest-1")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StoreUnavailableError);
    expect(JSON.stringify(error) + String(error)).not.toContain(TOKEN);
  });
});

describe("completion claims and the ledger in Redis", () => {
  it("claims with one atomic SET NX, and only the first claim wins", async () => {
    const fake = fakeRedis();
    await expect(store(fake).claimCompletion("guest-1", "m-1:0:0")).resolves.toBe(true);
    await expect(store(fake).claimCompletion("guest-1", "m-1:0:0")).resolves.toBe(false);

    // A single command, never a read followed by a write that could race.
    expect(fake.calls.map((call) => call.op)).toEqual(["set", "set"]);
  });

  it("appends with RPUSH rather than rewriting the ledger", async () => {
    const fake = fakeRedis();
    await store(fake).appendLedger("guest-1", { n: 1 });
    await store(fake).appendLedger("guest-1", { n: 2 });

    expect(fake.calls.map((call) => call.op)).not.toContain("set");
    await expect(store(fake).readLedger("guest-1")).resolves.toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("frees a released claim so a failed completion can be retried", async () => {
    const fake = fakeRedis();
    await store(fake).claimCompletion("guest-1", "m-1:0:0");
    await store(fake).releaseCompletion("guest-1", "m-1:0:0");
    await expect(store(fake).claimCompletion("guest-1", "m-1:0:0")).resolves.toBe(true);
  });

  it("keeps credentials out of a ledger failure", async () => {
    const error = await store(fakeRedis({ fail: true }))
      .appendLedger("guest-1", { n: 1 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StoreUnavailableError);
    expect(JSON.stringify(error) + String(error)).not.toContain(TOKEN);
  });
});
