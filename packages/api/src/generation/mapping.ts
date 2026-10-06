/**
 * Draft content -> client contract.
 *
 * Every field is copied by name. That is the point: if `@zandegi/ai` ever
 * grows a field again that a client must not see — an XP number, a rarity, a
 * raw model trace — it cannot reach the wire by accident, because nothing
 * here spreads an object.
 */

import { DOMAINS, SAFETY_CLASSES, VERIFICATION_METHODS } from "@zandegi/core";
import type {
  DraftChapter,
  DraftMission,
  DraftStep,
  GroundingReport,
  SafetyOutcome,
  Source,
  StageEvent,
} from "@zandegi/ai";
import { STAGE_NAMES } from "@zandegi/ai";
import {
  GENERATION_STAGES,
  type GenerationDomain,
  type GenerationProgress,
  type GenerationSafetyClass,
  type GenerationStage,
  type GenerationVerificationMethod,
  type MissionChapter,
  type MissionDraft,
  type MissionGroundingSummary,
  type MissionSafetyNotice,
  type MissionSource,
  type MissionStep,
} from "../client";

/**
 * Compile-time parity between the wire enums and core's domain types. A new
 * domain, verification method, safety class or stage that is not reflected in
 * `@zandegi/api/client` fails `pnpm typecheck` here rather than silently
 * producing a value the client cannot name.
 */
export const WIRE_ENUM_PARITY = {
  domains: DOMAINS satisfies readonly GenerationDomain[],
  verificationMethods: VERIFICATION_METHODS satisfies readonly GenerationVerificationMethod[],
  safetyClasses: SAFETY_CLASSES satisfies readonly GenerationSafetyClass[],
  stages: STAGE_NAMES satisfies readonly GenerationStage[],
  clientStages: GENERATION_STAGES,
} as const;

function toSource(source: Source): MissionSource {
  return {
    title: source.title,
    ...(source.url === undefined ? {} : { url: source.url }),
    date: source.date,
  };
}

export function toMissionStep(step: DraftStep): MissionStep {
  return {
    index: step.index,
    title: step.title,
    // A planning estimate. No progression number is derived from it.
    estimatedMinutes: step.estimatedMinutes,
    verification: step.verification,
    guide: {
      approach: step.guide.approach,
      materials: [...step.guide.materials],
      commonMistakes: [...step.guide.commonMistakes],
      whatGoodLooksLike: step.guide.whatGoodLooksLike,
    },
    sources: step.sources.map(toSource),
    toolKinds: [...step.toolKinds],
  };
}

export function toMissionChapter(chapter: DraftChapter): MissionChapter {
  return {
    index: chapter.index,
    title: chapter.title,
    exitCondition: chapter.exitCondition,
    steps: chapter.steps.map(toMissionStep),
  };
}

export function toMissionDraft(mission: DraftMission): MissionDraft {
  return {
    title: mission.title,
    goalType: mission.goalType,
    primaryDomain: mission.primaryDomain,
    chapters: mission.chapters.map(toMissionChapter),
  };
}

/** Redactions and blocked flags are server diagnostics, not client content. */
export function toSafetyNotice(safety: SafetyOutcome): MissionSafetyNotice {
  return {
    safetyClass: safety.safetyClass,
    professionalFrameApplied: safety.professionalFrameApplied,
  };
}

/** The findings themselves name internal locations, so only the count ships. */
export function toGroundingSummary(grounding: GroundingReport): MissionGroundingSummary {
  return {
    claimsChecked: grounding.claimsChecked,
    ungroundedClaims: grounding.ungroundedClaims.length,
    rewritten: grounding.rewritten,
    dropped: grounding.dropped,
  };
}

/** A stage error carries no detail outward: the reason stays server-side. */
export function toProgress(event: StageEvent): GenerationProgress {
  if (event.status === "error") return { stage: event.stage, status: "error" };
  return {
    stage: event.stage,
    status: event.status,
    ...(event.detail === undefined ? {} : { detail: event.detail }),
    ...(event.chapter === undefined ? {} : { chapter: toMissionChapter(event.chapter) }),
  };
}
