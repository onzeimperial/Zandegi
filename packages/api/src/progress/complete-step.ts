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
 * XP comes only from `@zandegi/core` (law 5): the evidence the person
 * provided and the step XP the ledger already holds, never anything the model
 * wrote. New awards are priced by `progression-v2`:
 *   - A generated step pays the v2 step reward, cut at the per-chapter cap
 *     counted from the ledger.
 *   - A step the person added pays nothing. It still has to be done (or
 *     skipped) before the chapter's boss, and its completion is recorded at 0.
 *   - No chapter bonus is written any more: a chapter pays for its boss
 *     (`../boss/attempt-boss`). The mission reward is fixed and paid once every
 *     boss is done, so adding or deleting steps can never change it.
 *
 * Steps are addressed by stable id (Story 7.2), never by position. A closed
 * chapter's undone steps are skipped for good: they are never current again.
 */

import { progressionV2StepAward } from "@zandegi/core";
import type { StepAward } from "@zandegi/core";
import type { AwardView, CompleteStepResult, MissionChapter, ProgressView } from "../client";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import { storeCall } from "../plan/store-call";
import type { Clock, GenerationPersistencePort, IdGenerator } from "../ports";
import { fingerprintPhoto } from "./evidence";
import { isGeneratedStepId } from "../plan/ids";
import { closedChapterIds, completedStepIds, foldProgress, nextStep, readEvents } from "./fold";
import { stepClaimId, type LedgerEvidence, type ProgressLedgerPort } from "./ledger";
import { currentProgress, eventBase, payOnce, settleMissionReward } from "./settle";

export type CompletionEvidenceInput = { kind: "SELF" } | { kind: "ARTIFACT"; bytes: Uint8Array };

export interface CompleteStepInput {
  /** The resolved owner. Completing never mints one. */
  principal: GuestPrincipal;
  /** Untrusted: from the URL. */
  missionId: unknown;
  /** Untrusted: from the form. A stable step id. */
  stepId: unknown;
  evidence: CompletionEvidenceInput;
}

export interface CompleteStepPorts {
  persistence: GenerationPersistencePort;
  ledger: ProgressLedgerPort;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * The award recorded for completing a step the person added. It pays nothing
 * (spec A, kept by spec B), and it is stamped with its own version so the
 * ledger says why it is zero.
 */
export const ADDED_STEP_AWARD_VERSION = "added-step-unpaid-v1";

const unpaidAward = (): StepAward => ({
  xp: 0,
  base: 0,
  verificationMult: 0,
  calculatorVersion: ADDED_STEP_AWARD_VERSION,
});

/** The step XP the ledger already holds for one chapter: what the cap is counted from. */
export function chapterStepXpPaid(
  progress: ProgressView,
  missionId: string,
  chapterId: string,
): number {
  return progress.completions
    .filter((entry) => entry.missionId === missionId && entry.chapterId === chapterId)
    .reduce((sum, entry) => sum + entry.xp, 0);
}

function findStep(chapters: readonly MissionChapter[], stepId: unknown) {
  if (typeof stepId !== "string") return undefined;
  for (const chapter of chapters) {
    if (chapter.steps.some((step) => step.id === stepId)) return { chapter, stepId };
  }
  return undefined;
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
  const target = findStep(chapters, input.stepId);
  if (target === undefined) {
    throw new GenerationError("INVALID_REQUEST", "step id is not in this mission");
  }
  const { chapter, stepId } = target;

  const ownerId = input.principal.id;
  const awards: AwardView[] = [];

  const before = await currentProgress(ports, ownerId);
  const done = completedStepIds(before, missionId);
  if (!done.has(stepId)) {
    if (nextStep(chapters, done, closedChapterIds(before, missionId))?.stepId !== stepId) {
      throw new GenerationError("STEP_NOT_CURRENT", "asked for a step that is not next");
    }

    // Evidence is checked before the claim, so a rejected photo never marks a
    // step as taken.
    const evidence: LedgerEvidence =
      input.evidence.kind === "SELF"
        ? { kind: "SELF" }
        : { kind: "ARTIFACT", ...(await fingerprintPhoto(input.evidence.bytes)) };
    const award = isGeneratedStepId(stepId)
      ? progressionV2StepAward(evidence.kind, chapterStepXpPaid(before, missionId, chapter.id))
      : unpaidAward();

    const paid = await payOnce(ports, ownerId, stepClaimId(missionId, stepId), {
      ...eventBase(ports, missionId),
      type: "StepCompleted",
      chapterId: chapter.id,
      stepId,
      evidence,
      award,
    });
    if (paid) awards.push({ kind: "step", xp: award.xp });
  }

  // Settled on every call, so a reward whose write failed earlier is paid now.
  const after = await currentProgress(ports, ownerId);
  awards.push(...(await settleMissionReward(ports, ownerId, missionId, chapters, after)));

  return { awards, progress: await currentProgress(ports, ownerId) };
}

/** The principal's progress, folded from their ledger. Never mints. */
export async function readProgress(
  input: { principal: GuestPrincipal },
  ports: { ledger: ProgressLedgerPort },
) {
  return foldProgress(readEvents(await storeCall(() => ports.ledger.read(input.principal.id))));
}
