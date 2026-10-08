/**
 * Complete one step of the principal's own mission, and pay for it once.
 *
 * The rules, in the order they are checked:
 *   - Ownership: the mission is read through `readMission`, so a mission that
 *     is not the principal's is `MISSION_NOT_FOUND`, indistinguishable from
 *     one that does not exist.
 *   - Repeats are not errors. Completing a step that is already complete pays
 *     nothing and answers with the current progress, so a double-tap or a
 *     retried request is harmless.
 *   - Order: only the next incomplete step can be completed (`STEP_NOT_CURRENT`
 *     otherwise), matching the path's current and upcoming steps.
 *   - Evidence: a self-check, or a photo that is checked and fingerprinted.
 *   - Once: every payment sits behind an atomic claim, so concurrent requests
 *     race to exactly one winner (NFR7, NFR8).
 *
 * XP comes only from `@zandegi/core`'s neutral award (law 5): the evidence the
 * person provided, never anything the model wrote.
 */

import {
  AWARD_CALCULATOR_VERSION,
  neutralChapterAward,
  neutralMissionAward,
  neutralStepAward,
} from "@zandegi/core";
import type { AwardView, CompleteStepResult } from "../client";
import { GenerationError, describeFailure, isGenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import type { Clock, GenerationPersistencePort, IdGenerator } from "../ports";
import { fingerprintPhoto } from "./evidence";
import { completedStepKeys, foldProgress, nextStep, readEvents } from "./fold";
import {
  chapterClaimId,
  missionClaimId,
  stepClaimId,
  type LedgerEvent,
  type LedgerEvidence,
  type ProgressLedgerPort,
} from "./ledger";

export type CompletionEvidenceInput = { kind: "SELF" } | { kind: "ARTIFACT"; bytes: Uint8Array };

export interface CompleteStepInput {
  /** The resolved owner. Completing never mints one. */
  principal: GuestPrincipal;
  /** Untrusted: from the URL. */
  missionId: unknown;
  /** Untrusted: from the form. */
  chapterIndex: unknown;
  /** Untrusted: from the form. */
  stepIndex: unknown;
  evidence: CompletionEvidenceInput;
}

export interface CompleteStepPorts {
  persistence: GenerationPersistencePort;
  ledger: ProgressLedgerPort;
  clock: Clock;
  ids: IdGenerator;
}

const isIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

async function storeCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isGenerationError(error)) throw error;
    throw new GenerationError("STORE_UNAVAILABLE", describeFailure(error), { cause: error });
  }
}

/**
 * Append `event` only if this call wins its claim. If the append then fails,
 * the claim is released so a retry can succeed rather than finding the step
 * marked paid with no record of the payment.
 */
async function payOnce(
  ports: CompleteStepPorts,
  ownerId: string,
  claimId: string,
  event: LedgerEvent,
): Promise<boolean> {
  const claimed = await storeCall(() => ports.ledger.claim(ownerId, claimId));
  if (!claimed) return false;
  try {
    await storeCall(() => ports.ledger.append(ownerId, event));
  } catch (error) {
    await ports.ledger.release(ownerId, claimId).catch(() => undefined);
    throw error;
  }
  return true;
}

async function currentProgress(ports: CompleteStepPorts, ownerId: string) {
  return foldProgress(readEvents(await storeCall(() => ports.ledger.read(ownerId))));
}

export async function completeStep(
  input: CompleteStepInput,
  ports: CompleteStepPorts,
): Promise<CompleteStepResult> {
  const view = await readMission(
    { principal: input.principal, missionId: input.missionId },
    { persistence: ports.persistence },
  );
  const { missionId } = view;
  const { chapters } = view.mission;
  const { chapterIndex, stepIndex } = input;
  if (
    !isIndex(chapterIndex) ||
    !isIndex(stepIndex) ||
    chapters[chapterIndex]?.steps[stepIndex] === undefined
  ) {
    throw new GenerationError("INVALID_REQUEST", "step position is not in this mission");
  }

  const ownerId = input.principal.id;
  const stepCounts = chapters.map((chapter) => chapter.steps.length);
  const awards: AwardView[] = [];
  const event = () => ({
    version: 1 as const,
    eventId: ports.ids.newId(),
    missionId,
    recordedAt: ports.clock.now().toISOString(),
  });

  const before = completedStepKeys(await currentProgress(ports, ownerId), missionId);
  if (!before.has(`${chapterIndex}:${stepIndex}`)) {
    const next = nextStep(stepCounts, before);
    if (next?.chapterIndex !== chapterIndex || next.stepIndex !== stepIndex) {
      throw new GenerationError("STEP_NOT_CURRENT", `asked for ${chapterIndex}:${stepIndex}`);
    }

    // Evidence is checked before the claim, so a rejected photo never marks a
    // step as taken.
    const evidence: LedgerEvidence =
      input.evidence.kind === "SELF"
        ? { kind: "SELF" }
        : { kind: "ARTIFACT", ...(await fingerprintPhoto(input.evidence.bytes)) };
    const award = neutralStepAward(evidence.kind);

    const paid = await payOnce(ports, ownerId, stepClaimId(missionId, chapterIndex, stepIndex), {
      ...event(),
      type: "StepCompleted",
      chapterIndex,
      stepIndex,
      evidence,
      award,
    });
    if (paid) awards.push({ kind: "step", xp: award.xp });
  }

  // Bonuses settle on every call, not only on the call that finished the
  // chapter. If a bonus write failed earlier, the next request for this mission
  // pays it; its own claim still means it can never be paid twice.
  const done = completedStepKeys(await currentProgress(ports, ownerId), missionId);
  const chapterDone = chapters.map(
    (chapter, index) =>
      chapter.steps.length > 0 &&
      chapter.steps.every((_step, step) => done.has(`${index}:${step}`)),
  );

  for (const [index, complete] of chapterDone.entries()) {
    if (!complete) continue;
    const xp = neutralChapterAward(stepCounts[index]!);
    const paid = await payOnce(ports, ownerId, chapterClaimId(missionId, index), {
      ...event(),
      type: "ChapterCompleted",
      chapterIndex: index,
      xp,
      calculatorVersion: AWARD_CALCULATOR_VERSION,
    });
    if (paid) awards.push({ kind: "chapter", xp });
  }

  if (chapterDone.length > 0 && chapterDone.every(Boolean)) {
    const xp = neutralMissionAward(stepCounts);
    const paid = await payOnce(ports, ownerId, missionClaimId(missionId), {
      ...event(),
      type: "MissionCompleted",
      xp,
      calculatorVersion: AWARD_CALCULATOR_VERSION,
    });
    if (paid) awards.push({ kind: "mission", xp });
  }

  return { awards, progress: await currentProgress(ports, ownerId) };
}

/** The principal's progress, folded from their ledger. Never mints. */
export async function readProgress(
  input: { principal: GuestPrincipal },
  ports: { ledger: ProgressLedgerPort },
) {
  return foldProgress(readEvents(await storeCall(() => ports.ledger.read(input.principal.id))));
}
