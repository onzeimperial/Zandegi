/**
 * Stage 8 — Safety pass (SPEC §2.2 stage 8, Part X). Pure routing by
 * safetyClass. SELF_HARM_ADJACENT never reaches generation; CLINICAL /
 * FINANCIAL / LEGAL get a professional-guidance frame and hard content
 * limits.
 */

import { isGenerationBlocked, requiresProfessionalFrame, type SafetyClass } from "@zandegi/core";
import type { ScoredMission, SafetyOutcome } from "../types";

// Phrases a CLINICAL / FINANCIAL / LEGAL mission must not contain. Redacted
// (the step is softened by a model rewrite the pipeline triggers) rather
// than shipped.
const CLINICAL_BANNED = [
  /\b\d{2,5}\s?(?:kcal|calories?)\b/i, // calorie targets
  /\blose\s+\d+\s?(?:kg|lbs?|pounds?)\s+(?:per|a|each)\s+week\b/i, // unsafe rate
  /\btake\s+\d+\s?(?:mg|ml|iu|mcg)\b/i, // doses
  /\byou (?:have|probably have|are showing signs of)\b/i, // diagnosis
];
const FINANCIAL_BANNED = [
  /\byou should (?:buy|sell|invest in|put your money in)\b/i, // personal advice
  /\bguaranteed returns?\b/i,
];
const LEGAL_BANNED = [/\byou should (?:sue|plead|sign|not sign)\b/i, /\bthis is legal advice\b/i];

function bannedFor(safetyClass: SafetyClass): RegExp[] {
  if (safetyClass === "CLINICAL") return CLINICAL_BANNED;
  if (safetyClass === "FINANCIAL") return FINANCIAL_BANNED;
  if (safetyClass === "LEGAL") return LEGAL_BANNED;
  return [];
}

export interface SafetyPassResult {
  outcome: SafetyOutcome;
  /** Chapter/step locations whose text tripped a banned pattern and needs a rewrite. */
  needsRewrite: { chapterIndex: number; stepIndex: number; pattern: string }[];
}

export function safetyPass(mission: ScoredMission, safetyClass: SafetyClass): SafetyPassResult {
  if (isGenerationBlocked(safetyClass)) {
    return {
      outcome: {
        safetyClass,
        blocked: true,
        professionalFrameApplied: false,
        redactions: [],
      },
      needsRewrite: [],
    };
  }

  const patterns = bannedFor(safetyClass);
  const needsRewrite: SafetyPassResult["needsRewrite"] = [];
  const redactions: string[] = [];

  if (patterns.length > 0) {
    for (const chapter of mission.chapters) {
      for (const step of chapter.steps) {
        const text = [
          step.title,
          step.guide.approach,
          ...step.guide.materials,
          ...step.guide.commonMistakes,
          step.guide.whatGoodLooksLike,
        ].join(" ");
        for (const re of patterns) {
          const m = text.match(re);
          if (m) {
            needsRewrite.push({ chapterIndex: chapter.index, stepIndex: step.index, pattern: re.source });
            redactions.push(m[0]);
          }
        }
      }
    }
  }

  return {
    outcome: {
      safetyClass,
      blocked: false,
      professionalFrameApplied: requiresProfessionalFrame(safetyClass),
      redactions,
    },
    needsRewrite,
  };
}
