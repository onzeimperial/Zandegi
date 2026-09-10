import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACHIEVEMENTS } from "@/server/achievements/definitions";
import { buildAchievementStats } from "@/server/achievements/evaluate";
import { seedAchievementsIfNeeded } from "@/server/achievements/seed-runtime";

export const GET = route(async () => {
  const user = await requireUser();
  await seedAchievementsIfNeeded();

  const [rows, stats] = await Promise.all([
    db.userAchievement.findMany({ where: { userId: user.id, goalId: null } }),
    buildAchievementStats(user.id),
  ]);
  const byKey = new Map(rows.map((r) => [r.achievementKey, r]));

  const items = ACHIEVEMENTS.map((a) => {
    const row = byKey.get(a.key);
    const progress = row?.unlockedAt ? 100 : Math.round(a.check(stats));
    return {
      key: a.key,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      tier: a.tier,
      xpReward: a.xpReward,
      secret: a.secret ?? false,
      progress,
      unlocked: !!row?.unlockedAt,
      unlockedAt: row?.unlockedAt ?? null,
    };
  });

  const unlocked = items.filter((i) => i.unlocked).length;
  return ok({
    items,
    summary: { unlocked, total: items.length, xpFromAchievements: items.filter((i) => i.unlocked).reduce((a, i) => a + i.xpReward, 0) },
  });
});
