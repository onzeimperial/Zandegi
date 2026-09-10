import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import type { ActivityKind, Rarity } from "@/lib/constants";

/** Write one activity event. Never throws into the caller's flow. */
export async function logActivity(input: {
  userId: string;
  kind: ActivityKind;
  title: string;
  rarity?: Rarity | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.activityEvent.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        rarity: input.rarity ?? null,
        meta: input.meta ? stringifyJson(input.meta) : null,
      },
    });
  } catch {
    // A missed feed entry should never break the action that triggered it.
  }
}
