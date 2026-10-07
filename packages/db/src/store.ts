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

/** 30 days of inactivity — configuration, not a constant (story 1.16). */
export const DEMO_RETENTION_DAYS = 30;
export const DEMO_RETENTION_SECONDS = DEMO_RETENTION_DAYS * 24 * 60 * 60;
