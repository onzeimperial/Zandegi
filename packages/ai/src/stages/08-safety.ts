/**
 * Stage 8 — Safety pass (SPEC §2.2 stage 8, Part X). Pure routing by
 * safetyClass. SELF_HARM_ADJACENT never reaches generation; CLINICAL /
 * FINANCIAL / LEGAL get a professional-guidance frame and hard content
 * limits.
 */

import { isGenerationBlocked, requiresProfessionalFrame, type SafetyClass } from "@zandegi/core";
import { issueId, stepTextFields } from "../rewrite";
import type { RewriteIssue, ScoredMission, SafetyOutcome } from "../types";

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
  /** Exact text fields whose content tripped one or more banned patterns. */
  needsRewrite: RewriteIssue[];
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
        for (const field of stepTextFields(chapter.index, step.index, step)) {
          const matches = patterns.flatMap((pattern) => {
            const match = field.text.match(pattern);
            return match ? [{ pattern: pattern.source, text: match[0] }] : [];
          });
          if (matches.length > 0) {
            needsRewrite.push({
              ...field,
              issueId: issueId("safety", field),
              issue: `Contains disallowed content: ${matches.map((match) => match.pattern).join(", ")}`,
            });
            redactions.push(...matches.map((match) => match.text));
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
