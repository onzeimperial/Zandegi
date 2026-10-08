/**
 * The demo store's shape, declared here rather than imported.
 *
 * AD-2 puts persistence in `@zandegi/db` and orchestration in
 * `@zandegi/api`, so the dependency runs api -> db and never back. That is
 * why this file re-declares the record shapes instead of importing
 * `@zandegi/api`'s ports: a type-only import the other way would make the two
 * packages mutually dependent. `@zandegi/api`'s adapter is what binds the two
 * together, and it fails `pnpm typecheck` the moment they drift.
 *
 * Nothing here knows what a mission *is*. `TMission` and `TSafetyClass` are
 * whatever the caller stores, which keeps the store free of contract knowledge
 * and makes the eventual Prisma implementation a third sibling rather than a
 * rewrite.
 */

/** A generated mission, owned by exactly one principal. Not a ledger fact. */
export interface StoredMission<TMission = unknown, TSafetyClass extends string = string> {
  /** Server-assigned. A client never supplies or influences it. */
  missionId: string;
  /** The guest principal that owns this record. */
  ownerId: string;
  runId: string;
  /** ISO-8601 UTC, from the caller's clock port. */
  generatedAt: string;
  goalText: string;
  pursuitSlug: string;
  mission: TMission;
  safetyClass: TSafetyClass;
}

/** A guest principal. The token itself is never stored, only its hash. */
export interface StoredGuest {
  id: string;
  /** ISO-8601 UTC, from the caller's clock port. */
  createdAt: string;
}

/**
 * One interface, two implementations: an in-memory twin for local development
 * and tests, and Upstash Redis for the deployed demo.
 *
 * Every read is keyed, never scanned: `findMission` takes the owner and the id
 * together, so an ownership-checked read is a single lookup and a miss is
 * indistinguishable from "owned by somebody else".
 */
export interface DemoStore<TMission = unknown, TSafetyClass extends string = string> {
  recordMission(record: StoredMission<TMission, TSafetyClass>): Promise<void>;
  /** `null` when the id is unknown *or* owned by another principal. */
  findMission(
    ownerId: string,
    missionId: string,
  ): Promise<StoredMission<TMission, TSafetyClass> | null>;
  /**
   * The owner's missions, newest first, at most `MAX_LISTED_MISSIONS`.
   *
   * Read through a per-owner index rather than a scan, keeping "every read is
   * keyed" true. A mission that has expired drops out of the list silently.
   */
  listMissions(ownerId: string): Promise<StoredMission<TMission, TSafetyClass>[]>;
  findGuest(tokenHash: string): Promise<StoredGuest | null>;
  saveGuest(tokenHash: string, guest: StoredGuest): Promise<void>;
  /** Renews the retention window. A no-op when the hash is unknown. */
  renewGuest(tokenHash: string): Promise<void>;
}

/**
 * The store could not answer. Deliberately carries no `cause`: a provider's
 * error message quotes the REST endpoint and sometimes the bearer token, and a
 * `cause` chain would smuggle both past the sanitiser into a log.
 */
export class StoreUnavailableError extends Error {
  readonly operation: string;
  /** Sanitised. Safe to log; still never safe to return to a client. */
  readonly detail: string;

  constructor(operation: string, detail: string) {
    super(`store unavailable: ${operation}`);
    this.name = "StoreUnavailableError";
    this.operation = operation;
    this.detail = detail;
  }
}

export function isStoreUnavailableError(value: unknown): value is StoreUnavailableError {
  return value instanceof StoreUnavailableError;
}

export const DEMO_KEY_PREFIX = "zandegi:demo";

export function missionKey(ownerId: string, missionId: string): string {
  return `${DEMO_KEY_PREFIX}:mission:${ownerId}:${missionId}`;
}

export function guestKey(tokenHash: string): string {
  return `${DEMO_KEY_PREFIX}:guest:${tokenHash}`;
}

/** The per-owner index of mission ids that makes listing a keyed read. */
export function ownerIndexKey(ownerId: string): string {
  return `${DEMO_KEY_PREFIX}:missions:${ownerId}`;
}

/** Bounds both the index and a listing, so one guest cannot grow either forever. */
export const MAX_LISTED_MISSIONS = 20;

/** One entry in an owner's index. */
export interface OwnerIndexEntry {
  missionId: string;
  /** ISO-8601 UTC, copied from the mission so the index sorts without reading it. */
  generatedAt: string;
}

function isOwnerIndexEntry(value: unknown): value is OwnerIndexEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OwnerIndexEntry).missionId === "string" &&
    typeof (value as OwnerIndexEntry).generatedAt === "string"
  );
}

/**
 * Parse a stored index defensively: anything malformed reads as empty rather
 * than throwing, so a corrupted index degrades to "no missions listed" instead
 * of breaking the page. The missions themselves are untouched.
 */
export function parseOwnerIndex(value: unknown): OwnerIndexEntry[] {
  return Array.isArray(value) ? value.filter(isOwnerIndexEntry) : [];
}

/**
 * The index after recording a mission: newest first, one entry per id, capped.
 *
 * Shared by both stores so the twin and Redis cannot disagree about order or
 * size. This is a read-modify-write, so two missions recorded at the same
 * instant for the same guest could lose one index entry; the mission itself
 * stays readable by id. Acceptable for the demo; the Prisma store replaces the
 * index with a query.
 */
export function withIndexEntry(
  index: readonly OwnerIndexEntry[],
  entry: OwnerIndexEntry,
): OwnerIndexEntry[] {
  return newestFirst([entry, ...index.filter((e) => e.missionId !== entry.missionId)]).slice(
    0,
    MAX_LISTED_MISSIONS,
  );
}

/** Newest first by `generatedAt`; ties keep their existing order. */
export function newestFirst<T extends { generatedAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

/** 30 days of inactivity — configuration, not a constant (story 1.16). */
export const DEMO_RETENTION_DAYS = 30;
export const DEMO_RETENTION_SECONDS = DEMO_RETENTION_DAYS * 24 * 60 * 60;
