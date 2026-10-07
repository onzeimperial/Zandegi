import { describe, expect, it } from "vitest";
import { createRedisDemoStore, type RedisLike } from "./redis";
import { StoreUnavailableError, guestKey, missionKey, type StoredMission } from "./store";

const URL = "https://demo-12345.upstash.io";
const TOKEN = "AX9zASQgYTEyMzQ1Njc4OTBhYmNkZWY";
const WINDOW = 1_234;

interface Call {
  op: "get" | "set" | "expire";
  key: string;
  ex?: number;
}

function fakeRedis(options: { data?: Record<string, string>; fail?: boolean } = {}) {
  const data = new Map(Object.entries(options.data ?? {}));
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
      data.set(key, value);
      return "OK";
    },
    async expire(key, seconds) {
      calls.push({ op: "expire", key, ex: seconds });
      if (options.fail) throw new Error(`fetch failed: POST ${URL}/expire (Bearer ${TOKEN})`);
      return data.has(key) ? 1 : 0;
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

    // The TTL *is* the cleanup: there is no sweep job to schedule.
    expect(fake.calls).toEqual([
      { op: "set", key: missionKey("guest-1", "m-1"), ex: WINDOW },
      { op: "set", key: guestKey("hash-a"), ex: WINDOW },
    ]);
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
