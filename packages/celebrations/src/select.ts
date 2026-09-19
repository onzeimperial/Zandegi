/**
 * Deterministic selection over a pre-generated celebration library. This is
 * the only logic that runs on the completion path — the model call already
 * happened offline when the clip was generated (CLAUDE.md §2.5).
 */

import type { Domain } from "@zandegi/core";
import type { CelebrationClip, CelebrationEventType } from "./types";

export interface SelectCelebrationInput {
  eventType: CelebrationEventType;
  domain: Domain;
  /**
   * Stable identifier for this completion (e.g. the ledger event id) that
   * drives which variant plays. Never derive this from Math.random or
   * Date.now — randomness must come from a passed seed (CLAUDE.md §2.5,
   * mirroring packages/core's rule).
   */
  seed: string;
}

/** Small stable string hash (FNV-1a). Deterministic, no dependencies. */
function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick(candidates: readonly CelebrationClip[], seed: string): CelebrationClip | null {
  if (candidates.length === 0) return null;
  const index = stableHash(seed) % candidates.length;
  return candidates[index] ?? null;
}

/**
 * Picks a clip for a completion moment. Falls back to the "Universal" base
 * tier of the same eventType if the domain doesn't have its own skin yet —
 * the matrix fills in incrementally per domain — then to null. Never throws;
 * callers show a static fallback on null (CLAUDE.md §6 empty-state rule).
 */
export function selectCelebrationClip(
  input: SelectCelebrationInput,
  library: readonly CelebrationClip[],
): CelebrationClip | null {
  const exact = library.filter(
    (clip) => clip.eventType === input.eventType && clip.domain === input.domain,
  );
  if (exact.length > 0) return pick(exact, input.seed);

  const universal = library.filter(
    (clip) => clip.eventType === input.eventType && clip.domain === "Universal",
  );
  return pick(universal, input.seed);
}
