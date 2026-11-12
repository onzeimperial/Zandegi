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
 *
 * Steps are addressed by stable id (Story 7.2), never by position, so a reorder
 * or a deletion cannot move a payment to a different step. Two rules keep plan
 * editing from changing what progress is worth:
 *   - A step the person added pays no XP. It still has to be done to finish its
 *     chapter, and its completion is still recorded, at 0 XP.
 *   - Chapter and mission bonuses are priced from the generated steps the person
 *     actually completed, so adding or deleting steps can never raise a bonus.
 *     With no edits that count is the chapter's step count, exactly as before.
 */

import {
  AWARD_CALCULATOR_VERSION,
  neutralChapterAward,
  neutralMissionAward,
  neutralStepAward,
} from "@zandegi/core";
import type { StepAward } from "@zandegi/core";
import type { AwardView, CompleteStepResult, MissionChapter } from "../client";
import { GenerationError, describeFailure, isGenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import type { Clock, GenerationPersistencePort, IdGenerator } from "../ports";
import { fingerprintPhoto } from "./evidence";
import { isGeneratedStepId } from "../plan/ids";
import { completedStepIds, foldProgress, nextStep, readEvents } from "./fold";
import {
  LEDGER_EVENT_VERSION,
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
 * until a reward policy for added steps exists (spec B), and it is stamped with
 * its own version so the ledger says why it is zero.
 */
export const ADDED_STEP_AWARD_VERSION = "added-step-unpaid-v1";

const unpaidAward = (): StepAward => ({
  xp: 0,
  base: 0,
  verificationMult: 0,
  calculatorVersion: ADDED_STEP_AWARD_VERSION,
});

/** Each chapter's completed generated steps, by chapter id. Deleted steps still count. */
function completedGeneratedSteps(
  completions: readonly { missionId: string; chapterId: string; stepId: string }[],
  missionId: string,
): Map<string, Set<string>> {
  const byChapter = new Map<string, Set<string>>();
  for (const completion of completions) {
    if (completion.missionId !== missionId || !isGeneratedStepId(completion.stepId)) continue;
    const steps = byChapter.get(completion.chapterId) ?? new Set<string>();
    steps.add(completion.stepId);
    byChapter.set(completion.chapterId, steps);
  }
  return byChapter;
}

function findStep(chapters: readonly MissionChapter[], stepId: unknown) {
  if (typeof stepId !== "string") return undefined;
  for (const chapter of chapters) {
    if (chapter.steps.some((step) => step.id === stepId)) return { chapter, stepId };
  }
  return undefined;
}

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
  const target = findStep(chapters, input.stepId);
  if (target === undefined) {
    throw new GenerationError("INVALID_REQUEST", "step id is not in this mission");
  }
  const { chapter, stepId } = target;

  const ownerId = input.principal.id;
  const awards: AwardView[] = [];
  const event = () => ({
    version: LEDGER_EVENT_VERSION,
    eventId: ports.ids.newId(),
    missionId,
    recordedAt: ports.clock.now().toISOString(),
  });

  const before = completedStepIds(await currentProgress(ports, ownerId), missionId);
  if (!before.has(stepId)) {
    if (nextStep(chapters, before)?.stepId !== stepId) {
      throw new GenerationError("STEP_NOT_CURRENT", "asked for a step that is not next");
    }

    // Evidence is checked before the claim, so a rejected photo never marks a
    // step as taken.
    const evidence: LedgerEvidence =
      input.evidence.kind === "SELF"
        ? { kind: "SELF" }
        : { kind: "ARTIFACT", ...(await fingerprintPhoto(input.evidence.bytes)) };
    const award = isGeneratedStepId(stepId) ? neutralStepAward(evidence.kind) : unpaidAward();

    const paid = await payOnce(ports, ownerId, stepClaimId(missionId, stepId), {
      ...event(),
      type: "StepCompleted",
      chapterId: chapter.id,
      stepId,
      evidence,
      award,
    });
    if (paid) awards.push({ kind: "step", xp: award.xp });
  }

  // Bonuses settle on every call, not only on the call that finished the
  // chapter. If a bonus write failed earlier, the next request for this mission
  // pays it; its own claim still means it can never be paid twice.
  const after = await currentProgress(ports, ownerId);
  const done = completedStepIds(after, missionId);
  const generated = completedGeneratedSteps(after.completions, missionId);
  const generatedCount = (chapterId: string) => generated.get(chapterId)?.size ?? 0;
  const chapterDone = chapters.map(
    (entry) => entry.steps.length > 0 && entry.steps.every((step) => done.has(step.id)),
  );

  for (const [index, complete] of chapterDone.entries()) {
    if (!complete) continue;
    const chapterId = chapters[index]!.id;
    const xp = neutralChapterAward(generatedCount(chapterId));
    // A chapter finished with no generated step done has no bonus yet. Writing
    // a 0 XP event would spend its claim, and spec B's reward could never pay.
    if (xp === 0) continue;
    const paid = await payOnce(ports, ownerId, chapterClaimId(missionId, chapterId), {
      ...event(),
      type: "ChapterCompleted",
      chapterId,
      xp,
      calculatorVersion: AWARD_CALCULATOR_VERSION,
    });
    if (paid) awards.push({ kind: "chapter", xp });
  }

  if (chapterDone.length > 0 && chapterDone.every(Boolean)) {
    const xp = neutralMissionAward(chapters.map((entry) => generatedCount(entry.id)));
    const paid =
      xp > 0 &&
      (await payOnce(ports, ownerId, missionClaimId(missionId), {
        ...event(),
        type: "MissionCompleted",
        xp,
        calculatorVersion: AWARD_CALCULATOR_VERSION,
      }));
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
