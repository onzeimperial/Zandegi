/**
 * The in-memory twin.
 *
 * It is the default for local development and the only store the test suite
 * touches, which is what keeps `pnpm verify` free of Upstash credentials and
 * of network access. It models the one behaviour Redis gives us for free —
 * expiry — because "a tampered or expired cookie mints a fresh principal" is a
 * rule the suite has to be able to exercise without waiting 30 days.
 *
 * What it deliberately does not model is durability across a restart. That is
 * the single reason the Redis sibling exists.
 */

import {
  guestKey,
  missionKey,
  DEMO_RETENTION_SECONDS,
  type DemoStore,
  type StoredGuest,
  type StoredMission,
} from "./store";

interface Entry {
  value: unknown;
  /** Epoch milliseconds, or `null` for an entry that never expires. */
  expiresAt: number | null;
}

export interface InMemoryStoreOptions {
  /** Seconds of inactivity before a record expires. */
  retentionSeconds?: number;
  /** Epoch milliseconds. Injected so a test can age the store deliberately. */
  now?: () => number;
}

export interface InMemoryDemoStore<
  TMission = unknown,
  TSafetyClass extends string = string,
> extends DemoStore<TMission, TSafetyClass> {
  /** Test and development affordance. Not part of `DemoStore`. */
  size(): number;
  clear(): void;
}

export function createInMemoryDemoStore<TMission = unknown, TSafetyClass extends string = string>(
  options: InMemoryStoreOptions = {},
): InMemoryDemoStore<TMission, TSafetyClass> {
  const retentionSeconds = options.retentionSeconds ?? DEMO_RETENTION_SECONDS;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry>();

  const expiryFrom = (): number | null =>
    retentionSeconds <= 0 ? null : now() + retentionSeconds * 1000;

  function read(key: string): unknown {
    const entry = entries.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= now()) {
      // Expired records become unreachable rather than deleted on a schedule;
      // dropping the entry here is the same thing a Redis TTL does.
      entries.delete(key);
      return null;
    }
    return entry.value;
  }

  function write(key: string, value: unknown): void {
    // Structured-cloned on the way in and out, so a caller holding the object
    // it stored cannot mutate the store afterwards. The Redis sibling
    // round-trips through JSON and gets this property for free; the twin has
    // to buy it, or the two stores would not behave the same.
    entries.set(key, { value: structuredClone(value), expiresAt: expiryFrom() });
  }

  return {
    async recordMission(record) {
      write(missionKey(record.ownerId, record.missionId), record);
    },

    async findMission(ownerId, missionId) {
      const key = missionKey(ownerId, missionId);
      const found = read(key);
      if (found === null) return null;
      // Touching a record renews its window, which is the whole of "any
      // request from the principal renews it" that this story commits to. A
      // mission the owner never looks at still expires on its own window;
      // richer renewal semantics are product-owned and deliberately deferred.
      entries.set(key, { value: found, expiresAt: expiryFrom() });
      return structuredClone(found) as StoredMission<TMission, TSafetyClass>;
    },

    async findGuest(tokenHash) {
      const found = read(guestKey(tokenHash));
      return found === null ? null : (structuredClone(found) as StoredGuest);
    },

    async saveGuest(tokenHash, guest) {
      write(guestKey(tokenHash), guest);
    },

    async renewGuest(tokenHash) {
      const key = guestKey(tokenHash);
      const found = read(key);
      if (found === null) return;
      entries.set(key, { value: found, expiresAt: expiryFrom() });
    },

    size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },
  };
}
