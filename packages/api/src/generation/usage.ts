/**
 * The per-person daily generation cap: spend protection, not a game mechanic.
 *
 * A slot is taken before any model call and is not given back if the run then
 * fails, because the failed run's calls were still paid for. It has no bearing
 * on progression and nothing can be bought to raise it (laws 1 and 8).
 */

import { GenerationError } from "../errors";
import type { Clock } from "../ports";
import type { Env } from "../demo-store";

export const DEFAULT_DAILY_GENERATION_LIMIT = 5;

export interface GenerationUsagePort {
  /** `true` when one of `limit` slots for `day` was free and is now taken. */
  claimSlot(ownerId: string, day: string, limit: number): Promise<boolean>;
}

export function dailyGenerationLimitFromEnv(env: Env): number {
  const raw = env.ZANDEGI_DAILY_GENERATION_LIMIT?.trim() ?? "";
  // A typo must not lift the cap, so anything but a whole number gets the default.
  return /^\d+$/.test(raw) ? Number(raw) : DEFAULT_DAILY_GENERATION_LIMIT;
}

/** Throws `DAILY_LIMIT_REACHED` when the person has used today's slots (UTC). */
export async function claimDailyGeneration(
  input: { principal: { id: string }; limit: number },
  ports: { usage: GenerationUsagePort; clock: Clock },
): Promise<void> {
  const day = ports.clock.now().toISOString().slice(0, 10);
  const granted = await ports.usage.claimSlot(input.principal.id, day, input.limit);
  if (!granted) throw new GenerationError("DAILY_LIMIT_REACHED", "daily generation limit reached");
}
