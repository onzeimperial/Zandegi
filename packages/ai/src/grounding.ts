/**
 * The grounding validator (pipeline stage 6). Pure and testable.
 *
 * CLAUDE.md §2.6: any step that asserts a fact, requirement, deadline,
 * price, or eligibility rule must carry a source with a freshness date, or
 * be rewritten as advice. This module *detects* the claims and checks their
 * sources. Rewriting a flagged claim into advice is a model call the
 * pipeline makes — not done here.
 */

import type { DraftStep, DraftMission, Source, GroundingReport } from "./types";

// Sentence-level heuristics for "this asserts a hard fact". Deliberately
// conservative toward false positives — a spuriously flagged sentence just
// gets a source attached or softened, which is cheap; a missed one ships an
// ungrounded claim, which is the thing we must not do.
const CLAIM_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "price", re: /(?:\$|£|€|A\$|USD|AUD)\s?\d[\d,]*(?:\.\d+)?/i },
  { name: "percentage", re: /\b\d{1,3}(?:\.\d+)?\s?%/ },
  {
    name: "deadline",
    re: /\b(?:deadline|closes?|due|by|before|no later than|cut[- ]?off)\b.{0,40}?\b(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{4}|\d{1,2}\/\d{1,2})/i,
  },
  {
    name: "requirement",
    re: /\b(?:you (?:must|need to|have to)|requires?|required|eligibility|eligible|minimum (?:of )?|prerequisite|mandatory|only if you)\b/i,
  },
  {
    name: "named-rule",
    re: /\b(?:ATAR|GPA|IELTS|TOEFL|SAT|UCAT|GAMSAT|Commonwealth Supported Place|CSP|HECS|visa|subclass \d+|award rate|award wage)\b/i,
  },
  { name: "stat", re: /\b(?:studies show|research shows|on average|\d+ out of \d+|the average \w+ is)\b/i },
];

/** Sentences in `text` that read as hard factual assertions. */
export function detectFactualClaims(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.filter((s) => CLAIM_PATTERNS.some((p) => p.re.test(s)));
}

/** A source is usable if it names something and carries a parseable, not-absurd date. */
export function isValidSource(source: Source, now: Date = new Date()): boolean {
  if (!source.title || source.title.trim().length < 3) return false;
  const t = Date.parse(source.date);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  const maxFuture = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  const minPast = new Date(now.getFullYear() - 30, 0, 1);
  return d >= minPast && d <= maxFuture;
}

export interface StepGroundingResult {
  claims: string[];
  ungrounded: string[];
}

/**
 * A step passes when it has at least one valid source for its claims. We do
 * not attempt per-claim source matching in v1 — one dated source on a step
 * that makes factual assertions is the bar. Per-claim linkage is a later
 * refinement, tracked in BUILD-LOG.
 */
export function validateStepGrounding(step: DraftStep, now: Date = new Date()): StepGroundingResult {
  const guideText = [
    step.guide.approach,
    ...step.guide.materials,
    ...step.guide.commonMistakes,
    step.guide.whatGoodLooksLike,
  ].join(". ");
  const claims = [...detectFactualClaims(step.title), ...detectFactualClaims(guideText)];

  if (claims.length === 0) return { claims, ungrounded: [] };

  const hasValidSource = step.sources.some((s) => isValidSource(s, now));
  return { claims, ungrounded: hasValidSource ? [] : claims };
}

export function validateMissionGrounding(mission: DraftMission, now: Date = new Date()): GroundingReport {
  let claimsChecked = 0;
  const ungroundedClaims: GroundingReport["ungroundedClaims"] = [];

  for (const chapter of mission.chapters) {
    for (const step of chapter.steps) {
      const r = validateStepGrounding(step, now);
      claimsChecked += r.claims.length;
      for (const claim of r.ungrounded) {
        ungroundedClaims.push({ chapterIndex: chapter.index, stepIndex: step.index, claim });
      }
    }
  }

  return { claimsChecked, ungroundedClaims, rewritten: 0, dropped: 0 };
}

/** True when nothing ungrounded remains — the session-1 exit bar. */
export function isFullyGrounded(report: GroundingReport): boolean {
  return report.ungroundedClaims.length === 0;
}
