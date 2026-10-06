/**
 * The ports a use case needs from the outside world.
 *
 * AD-2: `@zandegi/api` owns orchestration and the transaction boundary, and
 * everything impure reaches it as an explicit, injected port. Nothing here is
 * created inside `@zandegi/ai` — a package that writes content must not be
 * able to mint an authoritative timestamp, identifier, identity or fact.
 */

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

/** What the persistence port is handed once a draft is produced. */
export interface GeneratedMissionRecord {
  runId: string;
  /** ISO-8601 UTC, from the clock port. */
  generatedAt: string;
  goalText: string;
  pursuitSlug: string;
  mission: unknown;
  safetyClass: string;
}

/**
 * Where an accepted mission would be written.
 *
 * Deliberately a **no-op** in this story. Law 4: generation is not a
 * progression-ledger event, so there is no `MissionGenerated` fact to append;
 * story 1.19 implements the real atomic write through `@zandegi/db`'s unit of
 * work. The port exists now so the seam is injected rather than retrofitted.
 */
export interface GenerationPersistencePort {
  record(record: GeneratedMissionRecord): Promise<void>;
}

export const noopGenerationPersistence: GenerationPersistencePort = {
  // why-no-op: story 1.19 owns persistence; writing here would create the
  // ledger fact product law 4 forbids for generation.
  record: async () => undefined,
};
