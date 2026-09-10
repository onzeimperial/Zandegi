import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/server/achievements/definitions";
import { resolveTier, type PercentileResult } from "./percentile";

/**
 * Real percentile rarity for every achievement, computed from actual unlock
 * counts across every account. Below MIN_ACCOUNTS_FOR_PERCENTILE total
 * accounts this legitimately falls back to the authored tier for all of
 * them (see resolveTier) — with a single-account dev database that fallback
 * is what you should expect to see everywhere right now.
 */
export async function getAchievementRarities(): Promise<Map<string, PercentileResult>> {
  const [totalAccounts, unlockCounts] = await Promise.all([
    db.user.count(),
    db.userAchievement.groupBy({
      by: ["achievementKey"],
      where: { unlockedAt: { not: null }, goalId: null },
      _count: { _all: true },
    }),
  ]);

  const countByKey = new Map(unlockCounts.map((row) => [row.achievementKey, row._count._all]));

  const result = new Map<string, PercentileResult>();
  for (const def of ACHIEVEMENTS) {
    result.set(
      def.key,
      resolveTier({
        unlockedCount: countByKey.get(def.key) ?? 0,
        totalAccounts,
        authoredTier: def.tier,
      }),
    );
  }
  return result;
}
