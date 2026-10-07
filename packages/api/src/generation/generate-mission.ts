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
 *   - Law 4: no `MissionGenerated` ledger fact is created. The accepted
 *     mission is written as a relational record through the persistence port;
 *     nothing is appended to the ledger.
 *
 * Identity arrives the same way everything else impure does: the adapter
 * resolves the guest principal before this function is called, so the use case
 * never derives an owner and a client can never name one.
 */

import { generateMissionDraft } from "@zandegi/ai";
import type { GoalInput, MissionDraftOutcome, ProgressCallback } from "@zandegi/ai";
import type { GenerateMissionRequest, GenerationProgress, GenerationResult } from "../client";
import { GenerationError, describeFailure, isGenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
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
  /**
   * The resolved owner. Trusted, because the adapter minted or resolved it
   * from a server-held token hash — it is never read out of the request body,
   * which is also why `parseGenerateMissionRequest` rejects a body that
   * carries a principal or mission id field as an unknown field.
   */
  principal: GuestPrincipal;
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

  const mission = toMissionDraft(draft.mission);
  // Server-assigned, from the id port. The client learns it from the terminal
  // frame and cannot have influenced it.
  const missionId = ports.ids.newId();

  // Law 4: a relational record, not a ledger fact — no event type, no
  // `occurredAt`, nothing appended.
  //
  // A store failure fails the request. Returning a mission the server did not
  // keep would hand the client an id that resolves to nothing, so the honest
  // answer is a stable error.
  try {
    await ports.persistence.record({
      missionId,
      ownerId: input.principal.id,
      runId,
      generatedAt: meta.completedAt,
      goalText: draft.goalText,
      pursuitSlug: draft.pursuitSlug,
      mission,
      safetyClass: draft.safety.safetyClass,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (isGenerationError(error)) throw error;
    throw new GenerationError("STORE_UNAVAILABLE", describeFailure(error, [request.rawText]), {
      cause: error,
    });
  }

  return {
    outcome: "mission",
    missionId,
    mission,
    safety: toSafetyNotice(draft.safety),
    grounding: toGroundingSummary(draft.grounding),
    meta,
  };
}
