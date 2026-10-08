/**
 * The progression ledger (CLAUDE.md law 4, AD-1, AD-3).
 *
 * Completions are recorded as events that are only ever appended. Nothing --
 * total XP, level, which steps are done -- is stored as a running value; it is
 * all derived by folding these events. That is what makes "why did my XP
 * change?" answerable: every point traces to one event with its evidence and
 * the calculator version that priced it.
 *
 * Payloads hold minimal facts and opaque references only (AD-3): ids, indices,
 * an evidence kind, and for a photo its fingerprint, size and type. Never the
 * goal text, the mission body, or the photo itself.
 */

import type { StepAward } from "@zandegi/core";
import type { CompletionEvidence } from "../client";

/** What a photo leaves behind once it has been checked and discarded. */
export interface PhotoFingerprint {
  sha256: string;
  bytes: number;
  mediaType: string;
}

export type LedgerEvidence = { kind: "SELF" } | ({ kind: "ARTIFACT" } & PhotoFingerprint);

interface EventBase {
  /** Bumped when an event's shape changes, so old events stay readable. */
  version: 1;
  eventId: string;
  missionId: string;
  /** ISO-8601 UTC, from the server's clock port. Never the client's. */
  recordedAt: string;
}

export interface StepCompletedEvent extends EventBase {
  type: "StepCompleted";
  chapterIndex: number;
  stepIndex: number;
  evidence: LedgerEvidence;
  award: StepAward;
}

export interface ChapterCompletedEvent extends EventBase {
  type: "ChapterCompleted";
  chapterIndex: number;
  xp: number;
  calculatorVersion: string;
}

export interface MissionCompletedEvent extends EventBase {
  type: "MissionCompleted";
  xp: number;
  calculatorVersion: string;
}

export type LedgerEvent = StepCompletedEvent | ChapterCompletedEvent | MissionCompletedEvent;

/** Where the ledger lives. `@zandegi/db` implements it. */
export interface ProgressLedgerPort {
  /** Atomic set-if-absent. `true` only for the first caller. */
  claim(ownerId: string, claimId: string): Promise<boolean>;
  release(ownerId: string, claimId: string): Promise<void>;
  append(ownerId: string, event: LedgerEvent): Promise<void>;
  read(ownerId: string): Promise<unknown[]>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function hasBase(value: Record<string, unknown>): boolean {
  return (
    value.version === 1 &&
    isText(value.eventId) &&
    isText(value.missionId) &&
    isText(value.recordedAt)
  );
}

function isEvidence(value: unknown): value is LedgerEvidence {
  if (!isRecord(value)) return false;
  if (value.kind === "SELF") return true;
  return (
    value.kind === "ARTIFACT" &&
    isText(value.sha256) &&
    isIndex(value.bytes) &&
    isText(value.mediaType)
  );
}

function isAward(value: unknown): value is StepAward {
  return (
    isRecord(value) &&
    isIndex(value.xp) &&
    typeof value.base === "number" &&
    typeof value.verificationMult === "number" &&
    isText(value.calculatorVersion)
  );
}

/**
 * Read one stored entry, or `null` if it is not an event this version
 * understands. An unreadable entry is skipped rather than failing the whole
 * fold: one corrupt record must not lock a person out of all their progress.
 * (AD-3's quarantine and rebuild machinery is the production answer.)
 */
export function parseLedgerEvent(value: unknown): LedgerEvent | null {
  if (!isRecord(value) || !hasBase(value)) return null;
  switch (value.type) {
    case "StepCompleted":
      return isIndex(value.chapterIndex) &&
        isIndex(value.stepIndex) &&
        isEvidence(value.evidence) &&
        isAward(value.award)
        ? (value as unknown as StepCompletedEvent)
        : null;
    case "ChapterCompleted":
      return isIndex(value.chapterIndex) && isIndex(value.xp) && isText(value.calculatorVersion)
        ? (value as unknown as ChapterCompletedEvent)
        : null;
    case "MissionCompleted":
      return isIndex(value.xp) && isText(value.calculatorVersion)
        ? (value as unknown as MissionCompletedEvent)
        : null;
    default:
      return null;
  }
}

export function evidenceKind(evidence: LedgerEvidence): CompletionEvidence {
  return evidence.kind;
}

/** The claim id that makes a step pay once. */
export const stepClaimId = (missionId: string, chapterIndex: number, stepIndex: number) =>
  `${missionId}:step:${chapterIndex}:${stepIndex}`;

/** The claim id that makes a chapter bonus pay once. */
export const chapterClaimId = (missionId: string, chapterIndex: number) =>
  `${missionId}:chapter:${chapterIndex}`;

/** The claim id that makes a mission bonus pay once. */
export const missionClaimId = (missionId: string) => `${missionId}:mission`;
