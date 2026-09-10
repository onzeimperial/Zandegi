/**
 * Safety classification for a Pursuit (SPEC §1.2, Part X). Drives stage 8 of
 * the generation pipeline.
 */

export const SAFETY_CLASSES = [
  "NORMAL",
  "CLINICAL", // health / mental health — frame as "bring this to your GP", never prescribe
  "FINANCIAL", // education only, never personal advice; ASIC-aware disclosure
  "LEGAL", // education only, never legal advice
  "SELF_HARM_ADJACENT", // never generated — routes to a support screen
] as const;

export type SafetyClass = (typeof SAFETY_CLASSES)[number];

/** These pursuits are never turned into missions. Hard-coded, not a model call. */
export function isGenerationBlocked(safetyClass: SafetyClass): boolean {
  return safetyClass === "SELF_HARM_ADJACENT";
}

/** These pursuits get a professional-guidance frame and hard content limits. */
export function requiresProfessionalFrame(safetyClass: SafetyClass): boolean {
  return safetyClass === "CLINICAL" || safetyClass === "FINANCIAL" || safetyClass === "LEGAL";
}
