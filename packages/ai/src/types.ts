/**
 * Shared types for the generation pipeline (SPEC §2.1, §2.2).
 *
 * The Mission shape here is the pipeline's internal working representation.
 * The persisted shape (Prisma rows) is defined in @zandegi/db in session 3;
 * stage 9 maps between them.
 */

import type {
  Domain,
  DomainWeight,
  GoalType,
  EffortBand,
  SafetyClass,
  VerificationMethod,
} from "@zandegi/core";

// ── Stage 1: Interpret ─────────────────────────────────────

export interface GoalInput {
  /** The user's words, preserved verbatim forever (SPEC §2.1). */
  rawText: string;
  /** Optional context the client may already know. */
  timezone?: string;
  location?: string;
  /** Minutes per week the user can realistically give this. */
  weeklyTimeBudgetMinutes?: number;
}

export interface Interpretation {
  intent: string;
  goalType: GoalType;
  constraints: {
    deadline?: string; // ISO date, if the user gave one
    currentLevel?: string; // free text: "never run before", "grade 3 piano"
    resources?: string[]; // "has a gym membership", "owns a keyboard"
  };
  timeBudgetMinutesPerWeek: number;
  location?: string;
  /** Candidate pursuit slugs with confidence 0..1, best first. */
  pursuitMatches: { slug: string; confidence: number }[];
  /** Flags the interpreter raises for later stages. */
  notes: {
    isVague?: boolean;
    isImpossibleScope?: boolean;
    dependsOnVolatileFacts?: boolean;
  };
}

// ── Stage 2: Resolve ───────────────────────────────────────

export interface ResolvedPursuit {
  slug: string;
  domains: DomainWeight;
  goalType: GoalType;
  effortBand: EffortBand;
  safetyClass: SafetyClass;
  difficultyPrior: number;
  antiPatterns: string[];
  /** True when no pursuit cleared 0.62 and the generic scaffold is used. */
  usedGenericScaffold: boolean;
}

// ── Stage 3: Hydrate knowledge ─────────────────────────────

export interface KnowledgeSlotFill {
  slot: string;
  value: string;
  sources: Source[];
  fetchedAt: string; // ISO
  /** True when the value could not be freshly grounded and must be treated as advice. */
  stale: boolean;
}

// ── Stages 4–5: Plan + Detail ──────────────────────────────

export interface Source {
  title: string;
  url?: string;
  /** ISO date the fact was published or last verified. Required by the grounding validator. */
  date: string;
}

export interface StepGuide {
  approach: string;
  materials: string[];
  commonMistakes: string[];
  whatGoodLooksLike: string;
}

export interface DraftStep {
  index: number;
  title: string;
  estimatedMinutes: number;
  verification: VerificationMethod;
  guide: StepGuide;
  /** Every factual assertion in this step must be backed here (stage 6 enforces). */
  sources: Source[];
  /** Tool kinds to attach, resolved to instances by @zandegi/tools later. */
  toolKinds: string[];
}

export interface DraftChapter {
  index: number;
  title: string;
  exitCondition: string;
  steps: DraftStep[];
}

export interface DraftMission {
  title: string;
  goalType: GoalType;
  primaryDomain: Domain;
  chapters: DraftChapter[];
}

// ── Pipeline orchestration ─────────────────────────────────

/**
 * The seven content stages. `score` and `persist` were removed in story 1.3:
 * generation never emits a progression number (law 3/5) and never writes a
 * ledger fact. The clock, identifiers, cancellation and persistence belong to
 * `@zandegi/api`'s injected ports, not to this package.
 */
export const STAGE_NAMES = [
  "interpret",
  "resolve",
  "hydrate",
  "plan",
  "detail",
  "ground",
  "safety",
] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export interface StageEvent {
  stage: StageName;
  status: "start" | "done" | "error";
  detail?: string;
  /** Progressive reveal: validated draft chapters as they land (SPEC §2.2). */
  chapter?: DraftChapter;
}

export type ProgressCallback = (event: StageEvent) => void;

export interface GroundingReport {
  claimsChecked: number;
  ungroundedClaims: GroundingFinding[];
  rewritten: number;
  dropped: number;
}

export type StepTextField =
  | "title"
  | "guide.approach"
  | "guide.materials"
  | "guide.commonMistakes"
  | "guide.whatGoodLooksLike";

export interface TextFieldLocation {
  chapterIndex: number;
  stepIndex: number;
  field: StepTextField;
  itemIndex?: number;
}

export interface RewriteIssue extends TextFieldLocation {
  issueId: string;
  issue: string;
}

export interface GroundingFinding extends RewriteIssue {
  claim: string;
}

export interface SafetyOutcome {
  safetyClass: SafetyClass;
  blocked: boolean;
  professionalFrameApplied: boolean;
  redactions: string[];
}

/**
 * What `@zandegi/ai` returns: validated draft content plus the grounding,
 * safety and model metadata that justify it. No event, no `occurredAt`, no
 * duration — every authoritative timestamp comes from the API's clock port.
 */
export interface MissionDraft {
  goalText: string;
  pursuitSlug: string;
  mission: DraftMission;
  grounding: GroundingReport;
  safety: SafetyOutcome;
  /** Which model served each stage that called one. */
  modelsUsed: Partial<Record<StageName, string>>;
}

export interface DraftRefusal {
  reason: string;
  route: "support" | "clarify";
}

/** Exactly one of `draft` or `refusal` is set. */
export interface MissionDraftOutcome {
  draft: MissionDraft | null;
  /** Set when generation was blocked (SELF_HARM_ADJACENT) or otherwise refused. */
  refusal?: DraftRefusal;
}
