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

// ── Stage 7: Score (deterministic, @zandegi/core) ──────────

export interface ScoredStep extends DraftStep {
  baseXp: number;
}

export interface ScoredChapter extends Omit<DraftChapter, "steps"> {
  steps: ScoredStep[];
  completionXp: number;
}

export interface ScoredMission extends Omit<DraftMission, "chapters"> {
  chapters: ScoredChapter[];
  completionXp: number;
}

// ── Pipeline orchestration ─────────────────────────────────

export type StageName =
  | "interpret"
  | "resolve"
  | "hydrate"
  | "plan"
  | "detail"
  | "ground"
  | "score"
  | "safety"
  | "persist";

export interface StageEvent {
  stage: StageName;
  status: "start" | "done" | "error";
  detail?: string;
  /** Progressive reveal: chapters as they land (SPEC §2.2). */
  chapter?: ScoredChapter;
}

export type ProgressCallback = (event: StageEvent) => void;

export interface GroundingReport {
  claimsChecked: number;
  ungroundedClaims: { chapterIndex: number; stepIndex: number; claim: string }[];
  rewritten: number;
  dropped: number;
}

export interface SafetyOutcome {
  safetyClass: SafetyClass;
  blocked: boolean;
  professionalFrameApplied: boolean;
  redactions: string[];
}

export interface MissionGeneratedEvent {
  type: "MissionGenerated";
  occurredAt: string;
  payload: {
    goalText: string;
    pursuitSlug: string;
    mission: ScoredMission;
    grounding: GroundingReport;
    safety: SafetyOutcome;
    generationMeta: {
      modelsUsed: Partial<Record<StageName, string>>;
      totalMs: number;
    };
  };
}

export interface PipelineResult {
  event: MissionGeneratedEvent | null;
  /** Set when generation was blocked (SELF_HARM_ADJACENT) or otherwise refused. */
  refusal?: { reason: string; route: "support" | "clarify" };
}
