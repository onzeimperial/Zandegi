/**
 * Pure Seedance prompt templating. No model call happens here, and nothing
 * asserted in the output is a factual claim, so it sits outside both the
 * determinism rule (CLAUDE.md §2.5) and the grounding rule (§2.6) — it only
 * needs to be deterministic given its own inputs, which it is.
 */

import { DOMAIN_COVERS, type Domain } from "@zandegi/core";
import type { CelebrationEventType } from "./types";

const EVENT_INTENSITY: Record<CelebrationEventType, string> = {
  step_complete:
    "A quick, punchy celebration beat: a fist pump or a snappy one-move dance hit, energetic but brief.",
  chapter_complete:
    "A bigger celebratory flourish: a short dance combo of two or three moves, finishing on a confident pose.",
  level_up:
    "The biggest celebration of the three: an elaborate victory dance sequence building to a triumphant finishing pose, maximum energy.",
};

/**
 * Builds the Seedance prompt for one (domain, eventType, variant) clip.
 * Deterministic: identical inputs always produce identical text.
 */
export function buildCelebrationPrompt(
  domain: Domain,
  eventType: CelebrationEventType,
  variant: number,
): string {
  const cover = DOMAIN_COVERS[domain];
  const intensity = EVENT_INTENSITY[eventType];
  return (
    `Animated 3D character celebration, stylized friendly mobile-game mascot look, ` +
    `matching the supplied reference character. The scene reflects the "${domain}" life domain ` +
    `(${cover}). ${intensity} Variant ${variant}: use a distinct dance move, pose, and camera ` +
    `angle from other variants of this same moment so repeat plays don't feel identical. ` +
    `Cheerful warm lighting, upbeat celebratory music synced to the motion, no on-screen text.`
  );
}
