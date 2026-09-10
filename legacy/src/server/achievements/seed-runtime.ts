import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "./definitions";

let ensured = false;

/**
 * Idempotently mirror the achievement catalogue into the DB. Cheap and
 * safe to call from request paths; the in-process guard avoids repeat work.
 */
export async function seedAchievementsIfNeeded() {
  if (ensured) return;
  const count = await db.achievement.count();
  if (count >= ACHIEVEMENTS.length) {
    ensured = true;
    return;
  }
  for (const a of ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { key: a.key },
      create: {
        key: a.key,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        tier: a.tier,
        xpReward: a.xpReward,
        secret: a.secret ?? false,
        criteria: JSON.stringify({ note: "evaluated in code by key", key: a.key }),
      },
      update: {
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        tier: a.tier,
        xpReward: a.xpReward,
        secret: a.secret ?? false,
      },
    });
  }
  ensured = true;
}
