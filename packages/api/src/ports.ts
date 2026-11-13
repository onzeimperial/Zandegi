/**
 * The ports a use case needs from the outside world.
 *
 * AD-2: `@zandegi/api` owns orchestration and the transaction boundary, and
 * everything impure reaches it as an explicit, injected port. Nothing here is
 * created inside `@zandegi/ai` — a package that writes content must not be
 * able to mint an authoritative timestamp, identifier, identity or fact.
 */

import type {
  BossDebrief,
  BossEvidence,
  BossResult,
  GenerateMissionDetails,
  GenerationSafetyClass,
  MissionDraft,
  MissionLogView,
} from "./client";

/** The one source of "now" a use case may read. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Fixes the clock for tests and for replaying a run. */
export function fixedClock(instant: Date): Clock {
  return { now: () => new Date(instant.getTime()) };
}

/** The one source of identifiers. Clients never choose an identifier. */
export interface IdGenerator {
  newId(): string;
}

export const randomIdGenerator: IdGenerator = {
  newId: () => crypto.randomUUID(),
};

export function sequentialIdGenerator(prefix = "id"): IdGenerator {
  let next = 0;
  return { newId: () => `${prefix}-${++next}` };
}

/**
 * Cancellation, injected rather than created. The adapter owns the signal —
 * it knows about client disconnects and the application deadline — and the
 * use case only observes it.
 */
export interface CancellationPort {
  readonly signal: AbortSignal;
}

export function cancellationFrom(signal: AbortSignal): CancellationPort {
  return { signal };
}

/** A port that never cancels. Used where a caller has no deadline of its own. */
export const neverCancelled: CancellationPort = { signal: new AbortController().signal };

/** A knowledge fact that cleared freshness policy, resolved at `asOf`. */
export interface KnowledgeFact {
  slot: string;
  value: string;
  sources: { title: string; url?: string; date: string }[];
  /** ISO-8601 UTC instant the fact was fetched. */
  fetchedAt: string;
}

export interface KnowledgeRequest {
  /** Knowledge slots the resolved pursuit declares. */
  slots: string[];
  /** The one request-scoped evaluation instant, from the clock port. */
  asOf: Date;
}

/**
 * Freshness-approved knowledge. Story 1.17 implements a real resolver; until
 * then the empty resolver is honest — no knowledge layer exists, so no fact
 * is asserted, and the pipeline's hydrate stage stays a no-op.
 */
export interface KnowledgePort {
  resolve(request: KnowledgeRequest): Promise<KnowledgeFact[]>;
}

export const emptyKnowledge: KnowledgePort = {
  resolve: async () => [],
};

/**
 * What the person stated beyond the goal text. Personal content: it lives on
 * the deletable mission record, is never returned by a read, and never enters
 * the ledger or a log.
 */
export interface MissionGoalContext {
  timezone?: string;
  location?: string;
  weeklyTimeBudgetMinutes?: number;
  details?: GenerateMissionDetails;
}

/**
 * An accepted mission, as persistence receives it.
 *
 * `missionId` and `ownerId` are both server-assigned: the id comes from the
 * `IdGenerator` port and the owner from the guest principal the adapter
 * resolved before the request reached a use case. A client cannot supply or
 * influence either, and the request validator rejects a body that tries.
 *
 * `mission` holds the client-safe `MissionDraft` — the very value the terminal
 * frame carried. Storing the already-mapped draft is deliberate: the read path
 * then needs no knowledge of `@zandegi/ai`'s shapes, and no provider payload
 * or model trace can reach the store by being spread into it.
 *
 * This is a relational record, not a ledger fact (law 4). It has no event
 * type, no `occurredAt`, and generation never appends to the ledger.
 */
export interface GeneratedMissionRecord {
  missionId: string;
  ownerId: string;
  runId: string;
  /** ISO-8601 UTC, from the clock port. */
  generatedAt: string;
  goalText: string;
  pursuitSlug: string;
  mission: MissionDraft;
  safetyClass: GenerationSafetyClass;
  /** Absent when the person gave only the goal. */
  goalContext?: MissionGoalContext;
  /**
   * Bumped by every saved plan edit. Absent on a record that has never been
   * read back from a store; a store always answers with a number.
   */
  version?: number;
}

/**
 * Where an accepted mission is written and read back.
 *
 * Implemented in `@zandegi/db` — in memory for local development and tests,
 * in Upstash Redis for the deployed demo — and injected here so the eventual
 * Prisma store replaces an adapter and nothing above it.
 *
 * `findForOwner` takes the owner and the id together rather than fetching and
 * then comparing. A record the principal does not own is `null`, exactly like
 * an id that was never issued: a caller cannot tell the two apart, and that is
 * why the read returns not-found rather than forbidden.
 */
export interface GenerationPersistencePort {
  record(record: GeneratedMissionRecord): Promise<void>;
  findForOwner(ownerId: string, missionId: string): Promise<GeneratedMissionRecord | null>;
  /** The owner's missions, newest first. Never another principal's. */
  listForOwner(ownerId: string): Promise<GeneratedMissionRecord[]>;
}

/** What a compare-and-set plan update found. */
export type PlanUpdateOutcome = "updated" | "conflict" | "missing";

/**
 * Where an edited plan is saved. The update is a compare-and-set on the
 * mission's version, keyed on owner and id together, so a stale edit and an
 * edit to someone else's mission both save nothing.
 */
export interface MissionPlanStorePort {
  update(
    ownerId: string,
    missionId: string,
    expectedVersion: number,
    mission: MissionDraft,
  ): Promise<PlanUpdateOutcome>;
}

/** A log as stored: the view plus its owner. Personal content, deletable, never a ledger fact. */
export interface MissionLogRecord extends MissionLogView {
  ownerId: string;
}

/** Where logs live. Every call is keyed on the owner, so no input reaches another person's. */
export interface MissionLogStorePort {
  record(log: MissionLogRecord): Promise<void>;
  /** One mission's logs, newest first, bounded. */
  list(ownerId: string, missionId: string): Promise<MissionLogRecord[]>;
  /** `null` when the log is unknown, or not the owner's, or not on that mission. */
  move(
    ownerId: string,
    missionId: string,
    logId: string,
    chapterId: string,
  ): Promise<MissionLogRecord | null>;
}

/**
 * A boss attempt as stored: the raw result and the debrief. Personal content on
 * a deletable record. It never enters a log, an incident or the ledger, which
 * holds only `attemptId`.
 */
export interface BossAttemptRecord extends BossDebrief {
  attemptId: string;
  ownerId: string;
  missionId: string;
  chapterId: string;
  result: BossResult;
  evidence: BossEvidence;
  /** ISO-8601 UTC, from the server's clock. */
  attemptedAt: string;
}

/** Where boss attempts live. Keyed on the owner, like logs. */
export interface BossAttemptStorePort {
  record(attempt: BossAttemptRecord): Promise<void>;
  /** One mission's attempts for the owner, newest first, bounded. */
  list(ownerId: string, missionId: string): Promise<BossAttemptRecord[]>;
}
