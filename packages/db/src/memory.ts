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
  accountKey,
  usageKey,
  USAGE_RETENTION_SECONDS,
  completionKey,
  guestKey,
  ledgerKey,
  logsKey,
  missionKey,
  MAX_LISTED_LOGS,
  newestLogsFirst,
  MAX_LEDGER_ENTRIES,
  newestFirst,
  ownerIndexKey,
  parseOwnerIndex,
  withIndexEntry,
  DEMO_RETENTION_SECONDS,
  type DemoStore,
  type StoredGuest,
  type StoredMission,
  type StoredMissionLog,
  type StoredReminder,
  MAX_LISTED_REMINDERS,
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
  TContext = unknown,
> extends DemoStore<TMission, TSafetyClass, TContext> {
  /** Test and development affordance. Not part of `DemoStore`. */
  size(): number;
  clear(): void;
}

export function createInMemoryDemoStore<
  TMission = unknown,
  TSafetyClass extends string = string,
  TContext = unknown,
>(options: InMemoryStoreOptions = {}): InMemoryDemoStore<TMission, TSafetyClass, TContext> {
  const retentionSeconds = options.retentionSeconds ?? DEMO_RETENTION_SECONDS;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry>();
  // Reminder settings never expire: they belong to a signed-in account.
  const reminders = new Map<string, StoredReminder>();

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

  /** Every read answers with a version; a record starts at 0. */
  const versioned = (found: unknown) => {
    const mission = structuredClone(found) as StoredMission<TMission, TSafetyClass, TContext>;
    return { ...mission, version: mission.version ?? 0 };
  };

  const readLogs = (ownerId: string, missionId: string): StoredMissionLog[] => {
    const found = read(logsKey(ownerId, missionId));
    return Array.isArray(found) ? (found as StoredMissionLog[]) : [];
  };

  return {
    async recordMission(record) {
      write(missionKey(record.ownerId, record.missionId), { ...record, version: 0 });
      const indexKey = ownerIndexKey(record.ownerId);
      write(
        indexKey,
        withIndexEntry(parseOwnerIndex(read(indexKey)), {
          missionId: record.missionId,
          generatedAt: record.generatedAt,
        }),
      );
    },

    async listMissions(ownerId) {
      const indexKey = ownerIndexKey(ownerId);
      const index = parseOwnerIndex(read(indexKey));
      const missions: StoredMission<TMission, TSafetyClass, TContext>[] = [];
      for (const entry of index) {
        const found = read(missionKey(ownerId, entry.missionId));
        // An expired mission drops out rather than appearing as a gap.
        if (found !== null) missions.push(versioned(found));
      }
      // Listing is a request from the principal, so it renews the index window.
      if (index.length > 0) entries.set(indexKey, { value: index, expiresAt: expiryFrom() });
      return newestFirst(missions);
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
      return versioned(found);
    },

    async updateMission(ownerId, missionId, expectedVersion, mission) {
      // Compare-and-set with no await in between, so it cannot interleave.
      const key = missionKey(ownerId, missionId);
      const found = read(key);
      if (found === null) return "missing";
      const current = versioned(found);
      if (current.version !== expectedVersion) return "conflict";
      write(key, { ...current, mission, version: expectedVersion + 1 });
      return "updated";
    },

    async recordLog(log) {
      const key = logsKey(log.ownerId, log.missionId);
      write(key, [...readLogs(log.ownerId, log.missionId), log]);
    },

    async listLogs(ownerId, missionId) {
      return structuredClone(
        newestLogsFirst(readLogs(ownerId, missionId)).slice(0, MAX_LISTED_LOGS),
      );
    },

    async moveLog(ownerId, missionId, logId, chapterId) {
      const logs = readLogs(ownerId, missionId);
      const found = logs.find((log) => log.logId === logId);
      if (found === undefined) return null;
      const moved = { ...found, chapterId };
      write(
        logsKey(ownerId, missionId),
        logs.map((log) => (log.logId === logId ? moved : log)),
      );
      return structuredClone(moved);
    },

    async findReminder(ownerId) {
      const found = reminders.get(ownerId);
      return found === undefined ? null : structuredClone(found);
    },

    async enableReminder(reminder) {
      const existing = reminders.get(reminder.ownerId);
      // No zone given keeps the stored one rather than erasing it.
      const timezone = reminder.timezone ?? existing?.timezone;
      reminders.set(reminder.ownerId, {
        ownerId: reminder.ownerId,
        email: reminder.email,
        ...(timezone === undefined ? {} : { timezone }),
        updatedAt: reminder.updatedAt,
        ...(existing?.lastSentDay === undefined ? {} : { lastSentDay: existing.lastSentDay }),
      });
    },

    async disableReminder(ownerId, updatedAt) {
      const existing = reminders.get(ownerId);
      if (existing === undefined) return;
      reminders.set(ownerId, {
        ownerId,
        email: null,
        updatedAt,
        ...(existing.lastSentDay === undefined ? {} : { lastSentDay: existing.lastSentDay }),
      });
    },

    async listEnabledReminders() {
      return structuredClone(
        [...reminders.values()]
          .filter((reminder) => reminder.email !== null)
          .slice(0, MAX_LISTED_REMINDERS),
      );
    },

    async claimReminderDay(ownerId, day) {
      // Check-and-set with no await in between, like `claimCompletion`.
      const existing = reminders.get(ownerId);
      if (existing === undefined || existing.email === null || existing.lastSentDay === day) {
        return false;
      }
      reminders.set(ownerId, { ...existing, lastSentDay: day });
      return true;
    },

    async findGuest(tokenHash) {
      const found = read(guestKey(tokenHash));
      return found === null ? null : (structuredClone(found) as StoredGuest);
    },

    async saveGuest(tokenHash, guest) {
      write(guestKey(tokenHash), guest);
    },

    async findOrCreateAccountPrincipal(clerkUserId, candidate) {
      // No await between the read and the write, as with `claimCompletion`.
      const key = accountKey(clerkUserId);
      const found = read(key);
      if (found !== null) {
        entries.set(key, { value: found, expiresAt: expiryFrom() });
        return structuredClone(found) as StoredGuest;
      }
      write(key, candidate);
      return structuredClone(candidate);
    },

    async claimGenerationSlot(ownerId, day, limit) {
      const key = usageKey(ownerId, day);
      const used = read(key);
      const count = typeof used === "number" ? used : 0;
      if (count >= limit) return false;
      entries.set(key, { value: count + 1, expiresAt: now() + USAGE_RETENTION_SECONDS * 1000 });
      return true;
    },

    async claimCompletion(ownerId, completionId) {
      const key = completionKey(ownerId, completionId);
      // Check-and-set with no await between them, so it cannot interleave with
      // another claim: JavaScript runs this to completion. That is the twin's
      // equivalent of Redis's atomic SET NX.
      if (read(key) !== null) return false;
      write(key, true);
      return true;
    },

    async releaseCompletion(ownerId, completionId) {
      entries.delete(completionKey(ownerId, completionId));
    },

    async appendLedger(ownerId, entry) {
      const key = ledgerKey(ownerId);
      const existing = read(key);
      const ledger = Array.isArray(existing) ? existing : [];
      // A new array rather than a push, so an earlier reader's copy is never
      // changed underneath it: entries are appended, never edited.
      write(key, [...ledger, entry]);
    },

    async readLedger(ownerId) {
      const found = read(ledgerKey(ownerId));
      if (!Array.isArray(found)) return [];
      return structuredClone(found.slice(0, MAX_LEDGER_ENTRIES)) as unknown[];
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
      reminders.clear();
    },
  };
}
