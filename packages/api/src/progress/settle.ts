/**
 * Paying once, and the mission reward, shared by completing a step and
 * attempting a boss.
 */

import { PROGRESSION_V2_VERSION, progressionV2MissionAward, type BossBand } from "@zandegi/core";
import type { AwardView, MissionChapter, ProgressView } from "../client";
import { storeCall } from "../plan/store-call";
import type { Clock, IdGenerator } from "../ports";
import { chapterBoss, closedChapterIds, foldProgress, readEvents } from "./fold";
import {
  LEDGER_EVENT_VERSION,
  missionClaimId,
  type LedgerEvent,
  type ProgressLedgerPort,
} from "./ledger";

export interface LedgerWritePorts {
  ledger: ProgressLedgerPort;
  clock: Clock;
  ids: IdGenerator;
}

/** The fields every new event carries. */
export function eventBase(ports: LedgerWritePorts, missionId: string) {
  return {
    version: LEDGER_EVENT_VERSION,
    eventId: ports.ids.newId(),
    missionId,
    recordedAt: ports.clock.now().toISOString(),
  };
}

/**
 * Append `event` only if this call wins its claim. If the append then fails,
 * the claim is released so a retry can succeed rather than finding the claim
 * taken with no record of the payment.
 */
export async function payOnce(
  ports: { ledger: ProgressLedgerPort },
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

export async function currentProgress(
  ports: { ledger: ProgressLedgerPort },
  ownerId: string,
): Promise<ProgressView> {
  return foldProgress(readEvents(await storeCall(() => ports.ledger.read(ownerId))));
}

/**
 * Each boss chapter's best band so far, for the mission reward. A chapter
 * closed under `neutral-v1` has no boss and is left out; a chapter still open
 * counts as a boss not yet beaten.
 */
export function missionBossBands(
  chapters: readonly MissionChapter[],
  progress: ProgressView,
  missionId: string,
): (BossBand | null)[] {
  const closed = closedChapterIds(progress, missionId);
  const bands: (BossBand | null)[] = [];
  for (const chapter of chapters) {
    const boss = chapterBoss(progress, missionId, chapter.id);
    if (boss !== undefined) bands.push(boss.outcome);
    else if (!closed.has(chapter.id)) bands.push(null);
  }
  return bands;
}

/**
 * Pay the `progression-v2` mission reward if every boss is done. It settles on
 * every call, so a reward whose write failed earlier is paid by the next
 * request; the claim (shared with `neutral-v1`'s mission bonus) means a mission
 * is never paid twice.
 */
export async function settleMissionReward(
  ports: LedgerWritePorts,
  ownerId: string,
  missionId: string,
  chapters: readonly MissionChapter[],
  progress: ProgressView,
): Promise<AwardView[]> {
  const xp = progressionV2MissionAward(missionBossBands(chapters, progress, missionId));
  if (xp === 0) return [];
  const paid = await payOnce(ports, ownerId, missionClaimId(missionId), {
    ...eventBase(ports, missionId),
    type: "MissionCompleted",
    xp,
    calculatorVersion: PROGRESSION_V2_VERSION,
  });
  return paid ? [{ kind: "mission", xp }] : [];
}
