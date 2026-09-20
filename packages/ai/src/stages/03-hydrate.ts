/**
 * Stage 3 — Hydrate knowledge (SPEC §2.2). Deliberately a no-op today.
 *
 * This stage fills a Pursuit's `knowledgeSlots` from the knowledge layer
 * (`KnowledgeEntity`, global not per-user). Two things it depends on don't
 * exist yet: real seeded Pursuits with `knowledgeSlots` (BUILD-PROMPTS
 * session 2) and the `KnowledgeEntity` table plus fresh-lookup infra
 * (session 3). Every mission currently uses the generic scaffold, which has
 * no `knowledgeSlots` to fill — so there is genuinely nothing to hydrate
 * against, and this returns an empty result rather than faking one.
 */

import type { ResolvedPursuit, KnowledgeSlotFill } from "../types";

export async function hydrate(_resolved: ResolvedPursuit): Promise<KnowledgeSlotFill[]> {
  return [];
}
