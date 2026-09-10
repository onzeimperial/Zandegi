/**
 * How a step's completion is proven, and how much that evidence is worth
 * (SPEC §2.1 and §4.1). Stronger evidence pays more XP — this is what makes
 * "XP is earned by verified effort" (CLAUDE.md §2.3) mean something.
 */

export const VERIFICATION_METHODS = [
  "SELF", // the user says they did it
  "TIMER", // a focus/interval timer emitted the minutes
  "ARTIFACT", // a photo or file with an EXIF timestamp
  "METRIC", // a tracked quantity moved
  "INTEGRATION", // a connected provider (Strava, GitHub, Health...) confirmed it
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_MULT: Record<VerificationMethod, number> = {
  SELF: 1.0,
  TIMER: 1.15,
  ARTIFACT: 1.25,
  METRIC: 1.3,
  INTEGRATION: 1.4,
};

export function verificationMult(method: VerificationMethod): number {
  return VERIFICATION_MULT[method];
}
