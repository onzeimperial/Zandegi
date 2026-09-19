/**
 * Celebration clip types. A CelebrationClip is pre-generated content
 * (Seedance), never generated live on the completion path (CLAUDE.md §2.5) —
 * picking among an existing library is a pure function (see ./select).
 */

import type { Domain } from "@zandegi/core";

export const CELEBRATION_EVENT_TYPES = ["step_complete", "chapter_complete", "level_up"] as const;

export type CelebrationEventType = (typeof CELEBRATION_EVENT_TYPES)[number];

export function isCelebrationEventType(value: string): value is CelebrationEventType {
  return (CELEBRATION_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * A clip's domain, or "Universal" for a base-character clip that applies
 * across all 8 domains until a domain-specific skin exists.
 * `selectCelebrationClip` prefers an exact domain match and falls back to
 * "Universal" — an explicit fallback tier, not an arbitrary borrowed domain.
 */
export type CelebrationDomain = Domain | "Universal";

/**
 * One pre-generated clip in the library. Every field needed to reproduce or
 * audit the generation is kept, mirroring the ledger's provenance philosophy
 * (CLAUDE.md §2.4) even though this data isn't itself ledger state.
 */
export interface CelebrationClip {
  id: string;
  domain: CelebrationDomain;
  eventType: CelebrationEventType;
  /** 1-based variant index within (domain, eventType) — keeps prompts and picks stable. */
  variant: number;
  videoUrl: string;
  durationSec: number;
  hasAudio: boolean;
  prompt: string;
  referenceImageUrl?: string;
  model: string;
  generatedAt: string;
  sourceTaskId: string;
}
