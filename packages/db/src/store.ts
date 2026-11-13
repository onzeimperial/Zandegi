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
export interface StoredMission<
  TMission = unknown,
  TSafetyClass extends string = string,
  TContext = unknown,
> {
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
  /** What the person stated beyond the goal. Absent when there was nothing. */
  goalContext?: TContext;
  /**
   * Bumped by every plan update. Ignored by `recordMission`, which always
   * starts at 0; every read answers with it.
   */
  version?: number;
}

/** What a compare-and-set mission update found. */
export type MissionUpdateOutcome = "updated" | "conflict" | "missing";

/**
 * A progress log. Personal content on a deletable row, never a ledger fact, so
 * unlike the ledger it may be updated: moving it changes `chapterId`.
 */
export interface StoredMissionLog {
  logId: string;
  ownerId: string;
  missionId: string;
  chapterId: string;
  kind: "note" | "number";
  text?: string;
  value?: number;
  unit?: string;
  /** ISO-8601 UTC, from the caller's clock port. */
  loggedAt: string;
}

/**
 * One boss attempt: the raw result and the debrief. Personal content on a
 * deletable row, never a ledger fact. The ledger's `BossResolved` event refers
 * to it by id only, and must keep working once a person deletes it.
 */
export interface StoredBossAttempt {
  attemptId: string;
  ownerId: string;
  missionId: string;
  chapterId: string;
  result: "done" | "not-yet";
  evidence: "SELF" | "ARTIFACT";
  tips?: string;
  wentWell?: string;
  didntGoWell?: string;
  improve?: string;
  /** ISO-8601 UTC, from the caller's clock port. */
  attemptedAt: string;
}

/** Bounds a boss attempt listing. */
export const MAX_LISTED_BOSS_ATTEMPTS = 50;

/** Bounds a log listing. */
export const MAX_LISTED_LOGS = 50;

/**
 * One person's daily reminder setting. The address is personal content: it is
 * only ever used to send the reminder, never logged, and it is cleared when the
 * person turns reminders off. `lastSentDay` survives that, so turning reminders
 * off and on again cannot send a second email on the same day.
 */
export interface StoredReminder {
  ownerId: string;
  /** The verified sign-in address, or `null` once reminders are off. */
  email: string | null;
  /** The IANA zone the person's browser reported when they turned reminders on. */
  timezone?: string;
  /** ISO-8601 UTC, from the caller's clock port. */
  updatedAt: string;
  /** The local day (YYYY-MM-DD) of the last reminder claimed for sending. */
  lastSentDay?: string;
}

/** Bounds the daily sweep. Far above an invite-only test. */
export const MAX_LISTED_REMINDERS = 500;

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
export interface DemoStore<
  TMission = unknown,
  TSafetyClass extends string = string,
  TContext = unknown,
> {
  recordMission(record: StoredMission<TMission, TSafetyClass, TContext>): Promise<void>;
  /** `null` when the id is unknown *or* owned by another principal. */
  findMission(
    ownerId: string,
    missionId: string,
  ): Promise<StoredMission<TMission, TSafetyClass, TContext> | null>;
  /**
   * The owner's missions, newest first, at most `MAX_LISTED_MISSIONS`.
   *
   * Read through a per-owner index rather than a scan, keeping "every read is
   * keyed" true. A mission that has expired drops out of the list silently.
   */
  listMissions(ownerId: string): Promise<StoredMission<TMission, TSafetyClass, TContext>[]>;
  /**
   * Replace the mission body if, and only if, the stored version is
   * `expectedVersion`, and bump the version. Keyed on owner and id together:
   * another owner's mission is `"missing"`, exactly like an unknown one. Atomic,
   * so of two edits made against one version exactly one is `"updated"`.
   */
  updateMission(
    ownerId: string,
    missionId: string,
    expectedVersion: number,
    mission: TMission,
  ): Promise<MissionUpdateOutcome>;

  /** Save a log. The caller has already checked that the owner owns the mission. */
  recordLog(log: StoredMissionLog): Promise<void>;
  /** One mission's logs for one owner, newest first, at most `MAX_LISTED_LOGS`. */
  listLogs(ownerId: string, missionId: string): Promise<StoredMissionLog[]>;
  /** Refile a log. `null` when the log is unknown, another owner's, or on another mission. */
  moveLog(
    ownerId: string,
    missionId: string,
    logId: string,
    chapterId: string,
  ): Promise<StoredMissionLog | null>;

  /** Save a boss attempt. The caller has already checked that the owner owns the mission. */
  recordBossAttempt(attempt: StoredBossAttempt): Promise<void>;
  /** One mission's boss attempts for one owner, newest first, at most `MAX_LISTED_BOSS_ATTEMPTS`. */
  listBossAttempts(ownerId: string, missionId: string): Promise<StoredBossAttempt[]>;
  /** Delete one attempt. `false` when it is unknown or another owner's. */
  deleteBossAttempt(ownerId: string, attemptId: string): Promise<boolean>;
  /** The owner's reminder setting, on or off, or `null` if they never set one. */
  findReminder(ownerId: string): Promise<StoredReminder | null>;
  /**
   * Turn reminders on, or update the address and zone. Keeps `lastSentDay`, so
   * a reminder already sent today is not sent again.
   */
  enableReminder(
    reminder: Pick<StoredReminder, "ownerId" | "timezone" | "updatedAt"> & { email: string },
  ): Promise<void>;
  /** Turn reminders off and forget the address. A no-op when there is no setting. */
  disableReminder(ownerId: string, updatedAt: string): Promise<void>;
  /** Every setting that is on, at most `MAX_LISTED_REMINDERS`. */
  listEnabledReminders(): Promise<StoredReminder[]>;
  /**
   * Claim the one reminder for `day`. `true` only for the first claim of that
   * day while reminders are on, so a retried trigger cannot send twice. Atomic.
   */
  claimReminderDay(ownerId: string, day: string): Promise<boolean>;

  findGuest(tokenHash: string): Promise<StoredGuest | null>;
  saveGuest(tokenHash: string, guest: StoredGuest): Promise<void>;
  /** Renews the retention window. A no-op when the hash is unknown. */
  renewGuest(tokenHash: string): Promise<void>;

  /**
   * The principal for a signed-in account, created from `candidate` the first
   * time and returned unchanged after that. Atomic: requests racing for one
   * account all get the same principal.
   */
  findOrCreateAccountPrincipal(clerkUserId: string, candidate: StoredGuest): Promise<StoredGuest>;
  /**
   * Take one of `limit` generation slots for `day` (YYYY-MM-DD). `true` when one
   * was free. Atomic: requests racing for the last slot cannot both win.
   */
  claimGenerationSlot(ownerId: string, day: string, limit: number): Promise<boolean>;

  /**
   * Claim a completion atomically. `true` only for the first caller: a
   * double-tap, a retried request or two tabs all race to one winner, so a
   * step can never be paid twice. This is a single atomic set-if-absent, never
   * a read followed by a write.
   */
  claimCompletion(ownerId: string, completionId: string): Promise<boolean>;
  /** Undo a claim whose ledger write then failed, so the person can retry. */
  releaseCompletion(ownerId: string, completionId: string): Promise<void>;
  /**
   * Append one entry to the owner's ledger (law 4). Entries are only ever
   * appended -- never edited, never removed -- and progress is derived by
   * folding them. The store holds them opaquely; `@zandegi/api` owns the shape.
   */
  appendLedger(ownerId: string, entry: unknown): Promise<void>;
  /** The owner's ledger in append order, at most `MAX_LEDGER_ENTRIES`. */
  readLedger(ownerId: string): Promise<unknown[]>;
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

/** The account-to-principal link. */
export function accountKey(clerkUserId: string): string {
  return `${DEMO_KEY_PREFIX}:account:${clerkUserId}`;
}

/** One person's generation count for one day. */
export function usageKey(ownerId: string, day: string): string {
  return `${DEMO_KEY_PREFIX}:usage:${ownerId}:${day}`;
}

/** Outlives the day in every timezone. The count means nothing after that. */
export const USAGE_RETENTION_SECONDS = 2 * 24 * 60 * 60;

/** One owner's logs for one mission. */
export function logsKey(ownerId: string, missionId: string): string {
  return `${DEMO_KEY_PREFIX}:logs:${ownerId}:${missionId}`;
}

/** One owner's boss attempts, across their missions. */
export function bossAttemptsKey(ownerId: string): string {
  return `${DEMO_KEY_PREFIX}:boss:${ownerId}`;
}

/** One guest's append-only ledger. */
export function ledgerKey(ownerId: string): string {
  return `${DEMO_KEY_PREFIX}:ledger:${ownerId}`;
}

/** The atomic marker that a completion has been claimed. */
export function completionKey(ownerId: string, completionId: string): string {
  return `${DEMO_KEY_PREFIX}:done:${ownerId}:${completionId}`;
}

/** Bounds a ledger read. Far above anything a demo guest can reach. */
export const MAX_LEDGER_ENTRIES = 5000;

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

/**
 * Newest first by `loggedAt`, then by `logId` descending, so logs saved in the
 * same millisecond list in one stable order. Postgres orders the same way.
 */
export function newestLogsFirst(logs: readonly StoredMissionLog[]): StoredMissionLog[] {
  const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  return [...logs].sort((a, b) => desc(a.loggedAt, b.loggedAt) || desc(a.logId, b.logId));
}

/** Newest first by `attemptedAt`, then by id descending, matching Postgres. */
export function newestAttemptsFirst(attempts: readonly StoredBossAttempt[]): StoredBossAttempt[] {
  const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  return [...attempts].sort(
    (a, b) => desc(a.attemptedAt, b.attemptedAt) || desc(a.attemptId, b.attemptId),
  );
}

/** Newest first by `generatedAt`; ties keep their existing order. */
export function newestFirst<T extends { generatedAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

/** 30 days of inactivity — configuration, not a constant (story 1.16). */
export const DEMO_RETENTION_DAYS = 30;
export const DEMO_RETENTION_SECONDS = DEMO_RETENTION_DAYS * 24 * 60 * 60;
