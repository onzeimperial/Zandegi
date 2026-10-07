/**
 * The Upstash Redis store — the deployed demo's path.
 *
 * Three properties matter here and each one is load-bearing:
 *
 *  1. **The TTL is the cleanup.** Every value is written with the retention
 *     window as an expiry and renewed when it is touched, so there is no
 *     sweep job to run and nothing to forget to schedule.
 *  2. **Credentials never escape.** Upstash's client quotes the REST endpoint,
 *     and sometimes the bearer token, in its error messages. Every call is
 *     funnelled through `guard`, which sanitises the message and throws a
 *     `StoreUnavailableError` carrying no `cause`.
 *  3. **The SDK is imported lazily.** `@zandegi/api` reaches this module
 *     through its composition root, so a static import would pull the Upstash
 *     client into every process that touches the API — including the test
 *     suite, which must not need it.
 */

import {
  guestKey,
  missionKey,
  StoreUnavailableError,
  DEMO_RETENTION_SECONDS,
  type DemoStore,
  type StoredGuest,
  type StoredMission,
} from "./store";

/**
 * The slice of a Redis client this store uses. Declaring it keeps the Upstash
 * SDK out of this module's type surface and lets a test drive the real key and
 * TTL behaviour against a fake.
 */
export interface RedisLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options: { ex: number }): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface RedisStoreOptions {
  client: RedisLike;
  retentionSeconds?: number;
  /**
   * Strings that must never reach a log — the REST URL and the token. They are
   * replaced wherever they appear in a provider error message.
   */
  secrets?: readonly string[];
}

function sanitise(text: string, secrets: readonly string[]): string {
  let safe = text;
  for (const secret of secrets) {
    const trimmed = secret.trim();
    if (trimmed.length === 0) continue;
    safe = safe.split(trimmed).join("[redacted]");
  }
  // A bearer token can also arrive inside a header dump or a URL the caller
  // never configured, so strip anything credential-shaped as a second pass.
  return safe
    .replace(/https?:\/\/[^\s"']+/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .slice(0, 300);
}

export function createRedisDemoStore<TMission = unknown, TSafetyClass extends string = string>(
  options: RedisStoreOptions,
): DemoStore<TMission, TSafetyClass> {
  const { client } = options;
  const retentionSeconds = options.retentionSeconds ?? DEMO_RETENTION_SECONDS;
  const secrets = options.secrets ?? [];

  async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const raw =
        error instanceof Error ? `${error.name}: ${error.message}` : `non-error: ${typeof error}`;
      throw new StoreUnavailableError(operation, sanitise(raw, secrets));
    }
  }

  /**
   * Upstash decodes JSON for you by default, but a self-hosted client or a
   * changed `automaticDeserialization` setting hands back the raw string. Both
   * are accepted so the store does not depend on that setting.
   */
  function decode<T>(value: unknown): T | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return {
    async recordMission(record) {
      await guard("recordMission", () =>
        client.set(missionKey(record.ownerId, record.missionId), JSON.stringify(record), {
          ex: retentionSeconds,
        }),
      );
    },

    async findMission(ownerId, missionId) {
      const key = missionKey(ownerId, missionId);
      const raw = await guard("findMission", () => client.get(key));
      const found = decode<StoredMission<TMission, TSafetyClass>>(raw);
      if (found === null) return null;
      // Touching a record renews its window. A failure to renew must not fail
      // the read: the caller already has the mission.
      await guard("findMission", () => client.expire(key, retentionSeconds)).catch(() => undefined);
      return found;
    },

    async findGuest(tokenHash) {
      const raw = await guard("findGuest", () => client.get(guestKey(tokenHash)));
      return decode<StoredGuest>(raw);
    },

    async saveGuest(tokenHash, guest) {
      await guard("saveGuest", () =>
        client.set(guestKey(tokenHash), JSON.stringify(guest), { ex: retentionSeconds }),
      );
    },

    async renewGuest(tokenHash) {
      // `expire` on a missing key is a no-op in Redis, which is exactly the
      // contract: renewing an unknown hash tells the caller nothing.
      await guard("renewGuest", () => client.expire(guestKey(tokenHash), retentionSeconds));
    },
  };
}

export interface UpstashStoreOptions {
  url: string;
  token: string;
  retentionSeconds?: number;
}

/**
 * Build the deployed store. The SDK is imported here and nowhere else, so a
 * process that never configures Upstash never loads it.
 */
export async function createUpstashDemoStore<
  TMission = unknown,
  TSafetyClass extends string = string,
>(options: UpstashStoreOptions): Promise<DemoStore<TMission, TSafetyClass>> {
  const url = options.url.trim();
  const token = options.token.trim();
  if (url.length === 0 || token.length === 0) {
    throw new StoreUnavailableError("configure", "upstash url or token missing");
  }

  let client: RedisLike;
  try {
    const { Redis } = await import("@upstash/redis");
    client = new Redis({ url, token }) as unknown as RedisLike;
  } catch (error) {
    const raw = error instanceof Error ? error.name : "non-error";
    throw new StoreUnavailableError("configure", `upstash client unavailable (${raw})`);
  }

  return createRedisDemoStore<TMission, TSafetyClass>({
    client,
    ...(options.retentionSeconds === undefined
      ? {}
      : { retentionSeconds: options.retentionSeconds }),
    secrets: [url, token],
  });
}
