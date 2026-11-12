/**
 * Attempting a chapter's boss (Stories 7.4 and 7.5, simplified).
 *
 * A chapter's boss is its `exitCondition`: a real act, shown unchanged as the
 * person's own test. No model is called. The person attempts it, says "done"
 * or "not yet", answers at least one debrief prompt, and the chapter closes
 * whatever the result.
 *
 * The rules, in the order they are checked:
 *   - The request: a known chapter id, a result, at least one debrief answer,
 *     and `SELF` or `ARTIFACT` evidence. Anything else is `INVALID_REQUEST`.
 *   - Ownership: through `readMission`, so another person's mission is
 *     `MISSION_NOT_FOUND`, exactly like one that does not exist.
 *   - Readiness: an open chapter's boss can be attempted once it is the
 *     chapter the person is on and every step is done, or they choose to skip
 *     the rest (`BOSS_NOT_READY` otherwise). Skipped steps pay nothing and can
 *     never be completed later: a closed chapter is passed over for good. A
 *     chapter closed by a boss can be tried again. A chapter finished under
 *     `neutral-v1` has no boss.
 *   - Once: an attempt key from the form makes a double submit one attempt.
 *     The done band sits behind one claim per chapter, so "done" pays once
 *     however many times it is reached, and "not yet" never takes it.
 *
 * The raw result and the debrief go on a deletable `BossAttempt` record. They
 * are personal content and never reach a diagnostic, an incident or the
 * ledger, whose `BossResolved` event holds only the attempt's id and the facts
 * that priced its award.
 */

import { progressionV2BossAward } from "@zandegi/core";
import {
  BOSS_DEBRIEF_FIELDS,
  BOSS_DEBRIEF_LIMITS,
  type AwardView,
  type BossAttemptResult,
  type BossDebrief,
  type BossResult,
  type MissionChapter,
} from "../client";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import { applyPlanEdit } from "../plan/edit-plan";
import { storeCall } from "../plan/store-call";
import type {
  BossAttemptRecord,
  BossAttemptStorePort,
  Clock,
  GenerationPersistencePort,
  IdGenerator,
  MissionPlanStorePort,
} from "../ports";
import { fingerprintPhoto } from "../progress/evidence";
import type { CompletionEvidenceInput } from "../progress/complete-step";
import { chapterBoss, closedChapterIds, completedStepIds, missionPosition } from "../progress/fold";
import {
  bossAttemptClaimId,
  bossClaimId,
  bossCloseClaimId,
  type ProgressLedgerPort,
} from "../progress/ledger";
import { currentProgress, eventBase, payOnce, settleMissionReward } from "../progress/settle";

export interface BossAttemptRequest {
  chapterId: string;
  result: BossResult;
  /** The person chose to skip the chapter's undone steps. */
  skipRest: boolean;
  attemptKey: string;
  debrief: BossDebrief;
}

export interface AttemptBossInput {
  /** The resolved owner. Attempting never mints one. */
  principal: GuestPrincipal;
  /** Untrusted: from the URL. */
  missionId: unknown;
  /** Untrusted: the form's text fields, as a plain object. */
  request: unknown;
  evidence: CompletionEvidenceInput;
}

export interface AttemptBossPorts {
  persistence: GenerationPersistencePort;
  ledger: ProgressLedgerPort;
  plans: MissionPlanStorePort;
  bosses: BossAttemptStorePort;
  clock: Clock;
  ids: IdGenerator;
}

function invalid(diagnostic: string): never {
  throw new GenerationError("INVALID_REQUEST", diagnostic);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const ATTEMPT_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const REQUEST_FIELDS = ["chapterId", "result", "skipRest", "attemptKey", ...BOSS_DEBRIEF_FIELDS];

/** One answer: trimmed, possibly empty, within the limit. "Improve" must also be one line. */
function answer(value: unknown, field: (typeof BOSS_DEBRIEF_FIELDS)[number]): string {
  if (value === undefined) return "";
  if (typeof value !== "string") invalid(`${field} is not text`);
  const trimmed = value.trim();
  const max =
    field === "improve"
      ? BOSS_DEBRIEF_LIMITS.maxImproveLength
      : BOSS_DEBRIEF_LIMITS.maxAnswerLength;
  if (trimmed.length > max) invalid(`${field} too long`);
  if (field === "improve" && /[\r\n]/.test(trimmed)) invalid(`${field} spans lines`);
  return trimmed;
}

/** Strict: the known fields only, and at least one debrief answer. */
export function parseBossAttemptRequest(value: unknown): BossAttemptRequest {
  if (!isRecord(value)) invalid("body is not an object");
  for (const key of Object.keys(value)) {
    if (!REQUEST_FIELDS.includes(key)) invalid("boss attempt has an unknown field");
  }
  const { chapterId, result, skipRest, attemptKey } = value;
  if (typeof chapterId !== "string" || !ID_PATTERN.test(chapterId)) invalid("chapterId");
  if (result !== "done" && result !== "not-yet") invalid("result is not a boss result");
  if (skipRest !== undefined && typeof skipRest !== "boolean") invalid("skipRest");
  if (typeof attemptKey !== "string" || !ATTEMPT_KEY_PATTERN.test(attemptKey)) {
    invalid("attemptKey");
  }
  const debrief: BossDebrief = {};
  for (const field of BOSS_DEBRIEF_FIELDS) {
    const text = answer(value[field], field);
    if (text.length > 0) debrief[field] = text;
  }
  if (Object.keys(debrief).length === 0) invalid("debrief has no answer");
  return { chapterId, result, skipRest: skipRest === true, attemptKey, debrief };
}

/** How many times a carry-over retries a plan edit that raced another edit. */
const CARRY_OVER_ATTEMPTS = 3;

/**
 * Add "what I'll improve" as the first step of the chapter after `chapterId`,
 * through spec A's `addStep`: an `own-N` step that pays nothing and can be
 * removed. Best effort -- the attempt is already recorded, so a failure here
 * answers `null` and the person can add the step from Edit plan. Nothing is
 * added to a chapter that is already closed, where it could never be done.
 */
async function carryOver(
  input: AttemptBossInput,
  ports: AttemptBossPorts,
  chapterId: string,
  title: string,
  closed: ReadonlySet<string>,
): Promise<{ chapterId: string; stepId: string } | null> {
  for (let attempt = 0; attempt < CARRY_OVER_ATTEMPTS; attempt += 1) {
    try {
      const view = await readMission(
        { principal: input.principal, missionId: input.missionId },
        { persistence: ports.persistence },
      );
      const { chapters } = view.mission;
      const next: MissionChapter | undefined =
        chapters[chapters.findIndex((chapter) => chapter.id === chapterId) + 1];
      if (next === undefined || closed.has(next.id)) return null;

      const added = applyPlanEdit(view.mission, { op: "addStep", chapterId: next.id, title });
      const target = added.chapters.find((chapter) => chapter.id === next.id)!;
      const stepId = target.steps[target.steps.length - 1]!.id;
      const mission = applyPlanEdit(added, {
        op: "reorderSteps",
        chapterId: next.id,
        stepIds: [stepId, ...target.steps.slice(0, -1).map((step) => step.id)],
      });
      const outcome = await storeCall(() =>
        ports.plans.update(input.principal.id, view.missionId, view.version, mission),
      );
      if (outcome === "updated") return { chapterId: next.id, stepId };
      if (outcome === "missing") return null;
    } catch {
      // A chapter at its step limit, or a store failure: nothing is added.
      return null;
    }
  }
  return null;
}

export async function attemptBoss(
  input: AttemptBossInput,
  ports: AttemptBossPorts,
): Promise<BossAttemptResult> {
  const request = parseBossAttemptRequest(input.request);
  const kind: unknown = input.evidence.kind;
  if (kind !== "SELF" && kind !== "ARTIFACT") invalid("boss evidence is SELF or ARTIFACT");

  const view = await readMission(
    { principal: input.principal, missionId: input.missionId },
    { persistence: ports.persistence },
  );
  const { missionId } = view;
  const { chapters } = view.mission;
  const { chapterId } = request;
  if (!chapters.some((chapter) => chapter.id === chapterId)) {
    invalid("chapter id is not in this mission");
  }

  const ownerId = input.principal.id;
  const progress = await currentProgress(ports, ownerId);
  const closed = closedChapterIds(progress, missionId);
  const wasClosed = closed.has(chapterId);
  if (wasClosed && chapterBoss(progress, missionId, chapterId) === undefined) {
    invalid("a chapter finished before boss fights has no boss");
  }
  if (!wasClosed) {
    const position = missionPosition(chapters, completedStepIds(progress, missionId), closed);
    if (position.kind === "finished" || position.chapterId !== chapterId) {
      throw new GenerationError("BOSS_NOT_READY", "an earlier chapter is still open");
    }
    if (position.kind === "step" && !request.skipRest) {
      throw new GenerationError("BOSS_NOT_READY", "steps undone and not skipped");
    }
  }

  // Checked before any claim, so a rejected photo never uses up the attempt.
  if (input.evidence.kind === "ARTIFACT") await fingerprintPhoto(input.evidence.bytes);
  const award = progressionV2BossAward(request.result, input.evidence.kind);

  const attemptClaim = bossAttemptClaimId(missionId, request.attemptKey);
  const fresh = await storeCall(() => ports.ledger.claim(ownerId, attemptClaim));
  if (!fresh) {
    // The same attempt, sent again. Nothing new is recorded or paid, but a
    // mission reward whose write failed the first time is settled now.
    const awards = await settleMissionReward(ports, ownerId, missionId, chapters, progress);
    return {
      attemptId: null,
      result: request.result,
      awards,
      improveStep: null,
      progress: await currentProgress(ports, ownerId),
    };
  }

  const attemptId = ports.ids.newId();
  const awards: AwardView[] = [];
  const resolved = {
    ...eventBase(ports, missionId),
    type: "BossResolved" as const,
    attemptId,
    chapterId,
    band: award.band,
    evidence: award.evidence,
    xp: award.xp,
    selfDeclared: true as const,
    calculatorVersion: award.calculatorVersion,
  };
  const record: BossAttemptRecord = {
    attemptId,
    ownerId,
    missionId,
    chapterId,
    result: request.result,
    evidence: award.evidence,
    ...request.debrief,
    attemptedAt: ports.clock.now().toISOString(),
  };

  try {
    if (request.result === "done") {
      // One claim per chapter: a double submit, a second "done" and a race
      // all reach one payment.
      if (await payOnce(ports, ownerId, bossClaimId(missionId, chapterId), resolved)) {
        awards.push({ kind: "boss", xp: award.xp });
      }
    } else if (!wasClosed) {
      // "Not yet" closes the chapter at 0 XP and leaves the done claim free,
      // so trying again can still pay. A later "not yet" changes nothing.
      await payOnce(ports, ownerId, bossCloseClaimId(missionId, chapterId), resolved);
    }
    await storeCall(() => ports.bosses.record(record));
  } catch (error) {
    // Let the person send the same attempt again. Every payment above sits
    // behind its own claim, so a retry can never pay twice.
    await ports.ledger.release(ownerId, attemptClaim).catch(() => undefined);
    throw error;
  }

  const after = await currentProgress(ports, ownerId);
  awards.push(...(await settleMissionReward(ports, ownerId, missionId, chapters, after)));

  const improveStep =
    request.debrief.improve === undefined
      ? null
      : await carryOver(input, ports, chapterId, request.debrief.improve, closed);

  return {
    attemptId,
    result: request.result,
    awards,
    improveStep,
    progress: await currentProgress(ports, ownerId),
  };
}
