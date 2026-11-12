/**
 * The progression ledger (CLAUDE.md law 4, AD-1, AD-3).
 *
 * Completions are recorded as events that are only ever appended. Nothing --
 * total XP, level, which steps are done -- is stored as a running value; it is
 * all derived by folding these events. That is what makes "why did my XP
 * change?" answerable: every point traces to one event with its evidence and
 * the calculator version that priced it.
 *
 * Payloads hold minimal facts and opaque references only (AD-3): ids, an
 * evidence kind, and for a photo its fingerprint, size and type. Never the goal
 * text, the mission body, a log, or the photo itself.
 *
 * Version 1 events keyed steps and chapters by position. Version 2 keys them by
 * stable id (Story 7.2). `parseLedgerEvent` upcasts version 1 to ids on read --
 * the stored entry is never rewritten (law 4) -- and a position id is the
 * position itself, so the fold of old events is unchanged.
 */

import type { StepAward } from "@zandegi/core";
import type { BossEvidence, BossResult, CompletionEvidence } from "../client";
import { positionChapterId, positionStepId } from "../plan/ids";

/** What a photo leaves behind once it has been checked and discarded. */
export interface PhotoFingerprint {
  sha256: string;
  bytes: number;
  mediaType: string;
}

export type LedgerEvidence = { kind: "SELF" } | ({ kind: "ARTIFACT" } & PhotoFingerprint);

/** The version every new event is written with. */
export const LEDGER_EVENT_VERSION = 2 as const;

interface EventBase {
  /**
   * Bumped when an event's shape changes, so old events stay readable. A read
   * keeps the stored version, so a fold can tell an upcast event apart.
   */
  version: 1 | 2;
  eventId: string;
  missionId: string;
  /** ISO-8601 UTC, from the server's clock port. Never the client's. */
  recordedAt: string;
}

export interface StepCompletedEvent extends EventBase {
  type: "StepCompleted";
  /** The chapter the step was in. Steps never move between chapters. */
  chapterId: string;
  stepId: string;
  evidence: LedgerEvidence;
  award: StepAward;
}

export interface ChapterCompletedEvent extends EventBase {
  type: "ChapterCompleted";
  chapterId: string;
  xp: number;
  calculatorVersion: string;
}

export interface MissionCompletedEvent extends EventBase {
  type: "MissionCompleted";
  xp: number;
  calculatorVersion: string;
}

/**
 * A boss attempt that closed its chapter or paid its done band. The attempt's
 * raw result and debrief stay on the deletable `BossAttempt` record; the
 * ledger holds only the reference and the facts that priced the award. The id
 * may outlive its record, because a person can delete their debriefs.
 */
export interface BossResolvedEvent extends EventBase {
  type: "BossResolved";
  attemptId: string;
  chapterId: string;
  band: BossResult;
  evidence: BossEvidence;
  xp: number;
  /** A boss result is the person's own word, even with a photo: it is never judged. */
  selfDeclared: true;
  calculatorVersion: string;
}

export type LedgerEvent =
  StepCompletedEvent | ChapterCompletedEvent | BossResolvedEvent | MissionCompletedEvent;

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

const ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const isId = (value: unknown): value is string =>
  typeof value === "string" && ID_PATTERN.test(value);

function hasBase(value: Record<string, unknown>): boolean {
  return (
    (value.version === 1 || value.version === 2) &&
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
  return value.version === 1 ? parseVersion1(value) : parseVersion2(value);
}

/**
 * The upcaster for position-keyed events. Pure: the ids are the positions, the
 * same ids `upcastMission` gives the mission those positions belong to.
 */
function parseVersion1(value: Record<string, unknown>): LedgerEvent | null {
  const base = {
    version: 1 as const,
    eventId: value.eventId as string,
    missionId: value.missionId as string,
    recordedAt: value.recordedAt as string,
  };
  switch (value.type) {
    case "StepCompleted":
      return isIndex(value.chapterIndex) &&
        isIndex(value.stepIndex) &&
        isEvidence(value.evidence) &&
        isAward(value.award)
        ? {
            ...base,
            type: "StepCompleted",
            chapterId: positionChapterId(value.chapterIndex),
            stepId: positionStepId(value.chapterIndex, value.stepIndex),
            evidence: value.evidence,
            award: value.award,
          }
        : null;
    case "ChapterCompleted":
      return isIndex(value.chapterIndex) && isIndex(value.xp) && isText(value.calculatorVersion)
        ? {
            ...base,
            type: "ChapterCompleted",
            chapterId: positionChapterId(value.chapterIndex),
            xp: value.xp,
            calculatorVersion: value.calculatorVersion,
          }
        : null;
    case "MissionCompleted":
      return isIndex(value.xp) && isText(value.calculatorVersion)
        ? {
            ...base,
            type: "MissionCompleted",
            xp: value.xp,
            calculatorVersion: value.calculatorVersion,
          }
        : null;
    default:
      return null;
  }
}

function parseVersion2(value: Record<string, unknown>): LedgerEvent | null {
  switch (value.type) {
    case "StepCompleted":
      return isId(value.chapterId) &&
        isId(value.stepId) &&
        isEvidence(value.evidence) &&
        isAward(value.award)
        ? (value as unknown as StepCompletedEvent)
        : null;
    case "ChapterCompleted":
      return isId(value.chapterId) && isIndex(value.xp) && isText(value.calculatorVersion)
        ? (value as unknown as ChapterCompletedEvent)
        : null;
    case "BossResolved":
      return isId(value.attemptId) &&
        isId(value.chapterId) &&
        (value.band === "done" || value.band === "not-yet") &&
        (value.evidence === "SELF" || value.evidence === "ARTIFACT") &&
        isIndex(value.xp) &&
        value.selfDeclared === true &&
        isText(value.calculatorVersion)
        ? (value as unknown as BossResolvedEvent)
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

/**
 * The claim id that makes a step pay once. For a generated step the id is
 * `"c:s"`, so this is exactly the legacy `${missionId}:step:c:s`.
 */
export const stepClaimId = (missionId: string, stepId: string) => `${missionId}:step:${stepId}`;

/** The claim id that makes a chapter bonus pay once. Equal to the legacy key. */
export const chapterClaimId = (missionId: string, chapterId: string) =>
  `${missionId}:chapter:${chapterId}`;

/**
 * The claim id that makes a chapter's boss pay its done band once. "Not yet"
 * never takes it, so a later "done" can still be paid -- once.
 */
export const bossClaimId = (missionId: string, chapterId: string) =>
  `${missionId}:boss:${chapterId}`;

/** The claim id that lets exactly one "not yet" close a chapter. */
export const bossCloseClaimId = (missionId: string, chapterId: string) =>
  `${missionId}:boss-close:${chapterId}`;

/** The claim id that recognises a repeated submission of one attempt. */
export const bossAttemptClaimId = (missionId: string, attemptKey: string) =>
  `${missionId}:boss-attempt:${attemptKey}`;

/** The claim id that makes a mission bonus pay once. */
export const missionClaimId = (missionId: string) => `${missionId}:mission`;
