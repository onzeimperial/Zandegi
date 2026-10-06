/**
 * The one use case the generation adapter calls.
 *
 * `@zandegi/api` owns orchestration and the transaction boundary (AD-2).
 * `@zandegi/ai` contributes validated draft content and nothing else: the
 * clock, the run identifier, the cancellation signal, the knowledge resolver
 * and persistence all arrive here as injected ports.
 *
 * Two laws constrain the result shape and are asserted by the tests beside
 * this file:
 *   - Law 3/5: the result carries no XP, rarity, difficulty or priority.
 *   - Law 4: no `MissionGenerated` ledger fact is created. The persistence
 *     port is injected and is a no-op until story 1.19.
 */

import { generateMissionDraft } from "@zandegi/ai";
import type { GoalInput, MissionDraftOutcome, ProgressCallback } from "@zandegi/ai";
import type { GenerateMissionRequest, GenerationProgress, GenerationResult } from "../client";
import { GenerationError, describeFailure } from "../errors";
import type {
  CancellationPort,
  Clock,
  GenerationPersistencePort,
  IdGenerator,
  KnowledgePort,
} from "../ports";
import { toGroundingSummary, toMissionDraft, toProgress, toSafetyNotice } from "./mapping";
import { parseGenerateMissionRequest } from "./request";

/**
 * The content pipeline, as a port. Injecting it keeps this use case testable
 * without a model and makes the dependency direction explicit: the API calls
 * `ai`, never the reverse.
 */
export type MissionDraftGenerator = (
  input: GoalInput,
  onEvent: ProgressCallback | undefined,
  // `asOf` is required: the one request-scoped instant comes from the clock
  // port, so generation never reads an ambient clock. Assigning
  // `generateMissionDraft` as the default below is what keeps this in step.
  options: { asOf: Date; signal?: AbortSignal },
) => Promise<MissionDraftOutcome>;

export interface GenerateMissionPorts {
  clock: Clock;
  ids: IdGenerator;
  cancellation: CancellationPort;
  knowledge: KnowledgePort;
  persistence: GenerationPersistencePort;
  /** Defaults to `@zandegi/ai`'s pipeline. */
  draftGenerator?: MissionDraftGenerator;
}

export interface GenerateMissionInput {
  /** Untrusted. Validated here before any model call. */
  request: unknown;
  onProgress?: (progress: GenerationProgress) => void;
}

function toGoalInput(request: GenerateMissionRequest): GoalInput {
  return {
    rawText: request.rawText,
    ...(request.timezone === undefined ? {} : { timezone: request.timezone }),
    ...(request.location === undefined ? {} : { location: request.location }),
    ...(request.weeklyTimeBudgetMinutes === undefined
      ? {}
      : { weeklyTimeBudgetMinutes: request.weeklyTimeBudgetMinutes }),
  };
}

export async function generateMission(
  input: GenerateMissionInput,
  ports: GenerateMissionPorts,
): Promise<GenerationResult> {
  const request = parseGenerateMissionRequest(input.request);
  const generate = ports.draftGenerator ?? generateMissionDraft;
  const { signal } = ports.cancellation;

  // Cancellation is observed, never created, here.
  signal.throwIfAborted();

  const runId = ports.ids.newId();
  const startedAt = ports.clock.now();

  // One request-scoped evaluation instant for every fact this run uses
  // (epic 1 freshness rule). Story 1.17 gives this port a real resolver; the
  // pipeline's hydrate stage stays a no-op until it does.
  await ports.knowledge.resolve({ slots: [], asOf: startedAt });
  signal.throwIfAborted();

  let outcome: MissionDraftOutcome;
  try {
    outcome = await generate(
      toGoalInput(request),
      input.onProgress === undefined
        ? undefined
        : (event) => {
            if (signal.aborted) return;
            input.onProgress?.(toProgress(event));
          },
      { signal, asOf: startedAt },
    );
  } catch (error) {
    // A cancelled run has no terminal result: the abort is the outcome.
    if (signal.aborted) throw error;
    throw new GenerationError("GENERATION_FAILED", describeFailure(error, [request.rawText]), {
      cause: error,
    });
  }

  signal.throwIfAborted();

  const completedAt = ports.clock.now();
  const meta = {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
  };

  if (outcome.draft === null) {
    if (outcome.refusal === undefined) {
      throw new GenerationError(
        "GENERATION_FAILED",
        "draft generator returned neither a draft nor a refusal",
      );
    }
    return { outcome: "refusal", refusal: { ...outcome.refusal }, meta };
  }

  const draft = outcome.draft;

  // Law 4: this is not a ledger fact. The port is injected so story 1.19 can
  // make it a real atomic write without reopening this seam.
  await ports.persistence.record({
    runId,
    generatedAt: meta.completedAt,
    goalText: draft.goalText,
    pursuitSlug: draft.pursuitSlug,
    mission: draft.mission,
    safetyClass: draft.safety.safetyClass,
  });

  return {
    outcome: "mission",
    mission: toMissionDraft(draft.mission),
    safety: toSafetyNotice(draft.safety),
    grounding: toGroundingSummary(draft.grounding),
    meta,
  };
}
