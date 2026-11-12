/**
 * @zandegi/api/client — the client-safe generation contract.
 *
 * Apps import this subpath and nothing deeper (AD-2). It is types and frozen
 * literal tables only: no I/O, no model client, no Prisma, no server policy,
 * and deliberately no dependency on `@zandegi/ai`, so importing it can never
 * drag the pipeline into a browser bundle.
 *
 * Two product laws are visible in the shapes below:
 *   - Law 3/5: nothing here carries XP, rarity, difficulty or priority.
 *     Generation promises no progression number. `estimatedMinutes` is a
 *     planning estimate and is documented as non-authoritative.
 *   - Law 4: there is no `MissionGenerated` event. Generation is not a ledger
 *     fact, so the contract has no `occurredAt` and no event envelope.
 *
 * Story 1.4 owns the versioned wire protocol (protocol version, run ID,
 * monotonic sequence). This file is the pre-protocol contract the current
 * SSE adapter speaks, and 1.4 replaces it rather than extending it here.
 */

import type { GoalType } from "@zandegi/core/contracts";

// ── Request ────────────────────────────────────────────────

/**
 * What a person chose to tell us about their goal, in their own words. Every
 * field is optional. This text is personal content: it never reaches the
 * ledger, a log or an incident record.
 */
export interface GenerateMissionDetails {
  /** Where they are starting from. */
  startingPoint?: string;
  /** Why this matters to them. */
  why?: string;
  /** The date they are aiming for, as YYYY-MM-DD. Today or later. */
  targetDate?: string;
  /** What they can put toward it: kit, money, people, places. */
  resources?: string;
  /** What the plan has to work around. */
  planAround?: string;
}

export const GENERATE_MISSION_DETAIL_FIELDS = [
  "startingPoint",
  "why",
  "targetDate",
  "resources",
  "planAround",
] as const;

/** The only fields a client may send. The adapter rejects any other key. */
export interface GenerateMissionRequest {
  /** The user's words, preserved verbatim. */
  rawText: string;
  /** IANA timezone, e.g. "Australia/Melbourne". */
  timezone?: string;
  location?: string;
  weeklyTimeBudgetMinutes?: number;
  details?: GenerateMissionDetails;
}

export const GENERATE_MISSION_REQUEST_FIELDS = [
  "rawText",
  "timezone",
  "location",
  "weeklyTimeBudgetMinutes",
  "details",
] as const;

export const GENERATE_MISSION_LIMITS = {
  maxGoalLength: 2_000,
  maxLocationLength: 200,
  /** Each free-text detail field. */
  maxDetailLength: 500,
  maxTimezoneLength: 100,
  minWeeklyTimeBudgetMinutes: 1,
  /** Minutes in a week. */
  maxWeeklyTimeBudgetMinutes: 10_080,
} as const;

// ── Progress ───────────────────────────────────────────────

/**
 * The content stages a client may be told about, in the order they run. The
 * UI derives its stage list from this table rather than duplicating it.
 *
 * There is no `score` stage (generation assigns no number) and no `persist`
 * stage (generation writes no ledger fact).
 */
export const GENERATION_STAGES = [
  "interpret",
  "resolve",
  "hydrate",
  "plan",
  "detail",
  "ground",
  "safety",
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

export const GENERATION_STAGE_STATUSES = ["start", "done", "error"] as const;
export type GenerationStageStatus = (typeof GENERATION_STAGE_STATUSES)[number];

export interface GenerationProgress {
  stage: GenerationStage;
  status: GenerationStageStatus;
  /** Short, safe, user-facing detail. Never a stage trace or model output. */
  detail?: string;
  /** Progressive reveal: a chapter that cleared grounding and safety. */
  chapter?: MissionChapter;
}

export function isGenerationStage(value: unknown): value is GenerationStage {
  return (GENERATION_STAGES as readonly unknown[]).includes(value);
}

export function isGenerationStageStatus(value: unknown): value is GenerationStageStatus {
  return (GENERATION_STAGE_STATUSES as readonly unknown[]).includes(value);
}

// ── Mission draft ──────────────────────────────────────────

export const GENERATION_DOMAINS = [
  "Mind",
  "Edge",
  "Coin",
  "Body",
  "Grit",
  "Craft",
  "Bond",
  "World",
] as const;
export type GenerationDomain = (typeof GENERATION_DOMAINS)[number];

export const GENERATION_VERIFICATION_METHODS = [
  "SELF",
  "TIMER",
  "ARTIFACT",
  "METRIC",
  "INTEGRATION",
] as const;
export type GenerationVerificationMethod = (typeof GENERATION_VERIFICATION_METHODS)[number];

export const GENERATION_SAFETY_CLASSES = [
  "NORMAL",
  "CLINICAL",
  "FINANCIAL",
  "LEGAL",
  "SELF_HARM_ADJACENT",
] as const;
export type GenerationSafetyClass = (typeof GENERATION_SAFETY_CLASSES)[number];

export interface MissionSource {
  title: string;
  url?: string;
  /** ISO date the fact was published or last verified. */
  date: string;
}

export interface MissionStepGuide {
  approach: string;
  materials: string[];
  commonMistakes: string[];
  whatGoodLooksLike: string;
}

export interface MissionStep {
  /**
   * Stable for the life of the mission, and never reused. A generated step's id
   * comes from its generated position (`"chapter:step"`); a step the person adds
   * takes `"own-N"` from a per-mission counter that only increases. Progress
   * belongs to this id, never to where the step currently sits.
   */
  id: string;
  /** The step's current position in its chapter. Display only: nothing is keyed on it. */
  index: number;
  title: string;
  /**
   * A **planning estimate only**, in minutes. It is not authoritative, it is
   * not a target, and no XP, rank or reward is ever derived from it. Render it
   * as an estimate.
   */
  estimatedMinutes: number;
  verification: GenerationVerificationMethod;
  guide: MissionStepGuide;
  sources: MissionSource[];
  toolKinds: string[];
  /**
   * `"person"` when the person added this step or rewrote it. Such a step has no
   * sources, is never sent to a model and skips grounding: the words are theirs.
   * Absent for a step exactly as Zandegi generated it.
   */
  writtenBy?: "person";
}

export interface MissionChapter {
  /** Stable: the chapter's generated position. Chapters are never added or removed. */
  id: string;
  index: number;
  title: string;
  exitCondition: string;
  steps: MissionStep[];
}

export interface MissionDraft {
  title: string;
  goalType: GoalType;
  primaryDomain: GenerationDomain;
  chapters: MissionChapter[];
  /**
   * How many steps the person has ever added. Only increases, so an added
   * step's id is never reused, even after the step is deleted. Absent means 0.
   */
  addedStepCount?: number;
}

export interface MissionSafetyNotice {
  safetyClass: GenerationSafetyClass;
  professionalFrameApplied: boolean;
}

export interface MissionGroundingSummary {
  claimsChecked: number;
  /** Always 0 for a delivered draft: an ungrounded claim fails closed. */
  ungroundedClaims: number;
  rewritten: number;
  dropped: number;
}

/**
 * Where the run came from. `runId` and the timestamps come from the API's
 * injected id and clock ports — never from `@zandegi/ai`, and never from the
 * client.
 */
export interface GenerationRunMeta {
  runId: string;
  /** ISO-8601 UTC. */
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface GenerationRefusal {
  reason: string;
  route: "support" | "clarify";
}

export const GENERATION_REFUSAL_ROUTES = ["support", "clarify"] as const;

/** Exactly one terminal result per run. */
export type GenerationResult =
  | {
      outcome: "mission";
      /**
       * The stored mission's server-assigned id. It is what a client passes to
       * `GET /api/missions/{id}` to see this mission again, and it comes from
       * the API's id port — never supplied or influenced by a client.
       */
      missionId: string;
      mission: MissionDraft;
      safety: MissionSafetyNotice;
      grounding: MissionGroundingSummary;
      meta: GenerationRunMeta;
    }
  | {
      outcome: "refusal";
      refusal: GenerationRefusal;
      meta: GenerationRunMeta;
    };

/**
 * A mission read back by its owner.
 *
 * It carries no grounding summary and no run meta: both describe a generation
 * run, and a read is not one. The mission body is the same client-safe draft
 * the terminal frame carried, so nothing on this path has to re-derive it.
 */
export interface StoredMissionView {
  missionId: string;
  /** ISO-8601 UTC, from the clock port at generation time. */
  generatedAt: string;
  pursuitSlug: string;
  safetyClass: GenerationSafetyClass;
  mission: MissionDraft;
  /**
   * Bumped by every saved plan edit. An edit names the version it was made
   * against, and a stale one is refused with `PLAN_EDIT_CONFLICT`.
   */
  version: number;
}

// ── Plan editing ───────────────────────────────────────────

/**
 * One change to a mission's plan. There is deliberately no operation that adds
 * or removes a chapter, or edits a chapter's exit condition: those are refused
 * as `INVALID_REQUEST`.
 */
export type PlanEdit =
  | { op: "renameChapter"; chapterId: string; title: string }
  | { op: "editStep"; stepId: string; title?: string; approach?: string }
  | { op: "reorderSteps"; chapterId: string; stepIds: string[] }
  | { op: "addStep"; chapterId: string; title: string; approach?: string }
  | { op: "deleteStep"; stepId: string };

export const PLAN_EDIT_OPS = [
  "renameChapter",
  "editStep",
  "reorderSteps",
  "addStep",
  "deleteStep",
] as const;

export interface PlanEditRequest {
  /** The `version` of the mission the edit was made against. */
  version: number;
  edit: PlanEdit;
}

export const PLAN_EDIT_LIMITS = {
  maxTitleLength: 200,
  maxApproachLength: 2_000,
  maxStepsPerChapter: 50,
} as const;

// ── Logs ───────────────────────────────────────────────────

/**
 * Progress the plan did not foresee: a one-line note, or a number with an
 * optional unit. A log pays no XP and never reaches a model. Its text is
 * personal content: it never enters a log line, an incident or the ledger.
 */
export type MissionLogInput =
  { kind: "note"; text: string } | { kind: "number"; value: number; unit?: string };

export interface MissionLogView {
  logId: string;
  missionId: string;
  /** The chapter it is filed under: the current one when logged, movable later. */
  chapterId: string;
  kind: "note" | "number";
  text?: string;
  value?: number;
  unit?: string;
  /** ISO-8601 UTC, from the server's clock. */
  loggedAt: string;
}

export const MISSION_LOG_LIMITS = {
  maxTextLength: 280,
  maxUnitLength: 24,
  /** Absolute value. Keeps a number a person could plausibly mean. */
  maxValue: 1_000_000_000,
} as const;

// ── Errors ─────────────────────────────────────────────────

/**
 * Stable error codes. These are part of the contract: clients branch on them,
 * so a code is never renamed, only added. Diagnostic detail (stage names,
 * model messages, the user's goal text) stays server-side.
 */
export const GENERATION_ERROR_CODES = [
  "GENERATION_DISABLED",
  "UNSUPPORTED_MEDIA_TYPE",
  "PAYLOAD_TOO_LARGE",
  "INVALID_JSON",
  "INVALID_REQUEST",
  "GENERATION_TIMEOUT",
  "GENERATION_FAILED",
  // Appended, never reordered or renamed: clients branch on these.
  "CROSS_SITE_REQUEST",
  "MISSION_NOT_FOUND",
  "STORE_UNAVAILABLE",
  "STEP_NOT_CURRENT",
  "EVIDENCE_REJECTED",
  "SIGN_IN_REQUIRED",
  "ACCOUNT_NOT_ALLOWED",
  "DAILY_LIMIT_REACHED",
  "PLAN_EDIT_CONFLICT",
] as const;

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number];

export const GENERATION_ERROR_MESSAGES: Record<GenerationErrorCode, string> = {
  GENERATION_DISABLED: "Mission generation is unavailable.",
  UNSUPPORTED_MEDIA_TYPE: "Send an application/json request.",
  PAYLOAD_TOO_LARGE: "The request body is too large.",
  INVALID_JSON: "Send a valid JSON body.",
  INVALID_REQUEST: "The request fields are invalid.",
  GENERATION_TIMEOUT: "Mission generation timed out. Try again.",
  GENERATION_FAILED: "Mission generation failed. Try again.",
  CROSS_SITE_REQUEST: "This request did not come from Zandegi.",
  MISSION_NOT_FOUND: "That mission is not available.",
  STORE_UNAVAILABLE: "Your missions are temporarily unavailable. Try again.",
  STEP_NOT_CURRENT: "Finish the earlier steps in this mission first.",
  EVIDENCE_REJECTED: "That file isn't a photo we can accept. Try a JPEG, PNG, WebP or HEIC.",
  SIGN_IN_REQUIRED: "Sign in to continue.",
  ACCOUNT_NOT_ALLOWED: "Zandegi is invite-only for now, and this account isn't on the list.",
  DAILY_LIMIT_REACHED:
    "You've reached today's build limit. Your existing missions are ready. More builds open within 24 hours.",
  PLAN_EDIT_CONFLICT:
    "This plan changed somewhere else, so nothing was saved. Reload to see the latest version.",
};

export interface GenerationErrorBody {
  code: GenerationErrorCode;
  message: string;
  requestId: string;
}

export function generationErrorBody(
  code: GenerationErrorCode,
  requestId: string,
): { error: GenerationErrorBody } {
  return { error: { code, message: GENERATION_ERROR_MESSAGES[code], requestId } };
}

// ── Progress ───────────────────────────────────────────────

/**
 * The evidence offered for a completed step. A photo is checked to be a real
 * image and fingerprinted, then discarded: the photo itself is never kept.
 * It is checked to *be* an image, not to *show* the step.
 */
export const COMPLETION_EVIDENCE = ["SELF", "ARTIFACT"] as const;
export type CompletionEvidence = (typeof COMPLETION_EVIDENCE)[number];

/**
 * The largest photo accepted, in bytes. Vercel rejects a function request body
 * over 4.5 MB before application code runs, so the limit sits under that with
 * room for the multipart framing. The browser downscales larger photos first.
 */
export const MAX_EVIDENCE_PHOTO_BYTES = 4 * 1024 * 1024;

export interface StepCompletionView {
  missionId: string;
  /** The chapter the step belonged to when it was completed. */
  chapterId: string;
  stepId: string;
  evidence: CompletionEvidence;
  xp: number;
  /** ISO-8601 UTC, from the server's clock. */
  recordedAt: string;
}

/**
 * Everything derived from the guest's ledger. Nothing here is stored as a
 * running total: it is folded from append-only events every time (law 4).
 */
export interface ProgressView {
  totalXp: number;
  level: number;
  rank: string;
  /**
   * Earned XP into the current level, and the size of the level. Both are
   * measured, not estimated, so a level bar is honest in a way a mission
   * percentage would not be.
   */
  xpIntoLevel: number;
  xpForThisLevel: number;
  completions: StepCompletionView[];
  completedChapters: { missionId: string; chapterId: string }[];
  completedMissions: string[];
}

export interface AwardView {
  kind: "step" | "chapter" | "mission";
  xp: number;
}

export interface CompleteStepResult {
  /** Empty when the step was already complete: the request was a repeat. */
  awards: AwardView[];
  progress: ProgressView;
}
