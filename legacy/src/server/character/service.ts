import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { levelProgress } from "@/server/xp/levels";
import { getLifeStar } from "@/server/domains/service";
import { getAchievementRarities } from "@/server/rarity/service";
import { ACHIEVEMENTS } from "@/server/achievements/definitions";
import { PERCENTILE_TIERS, type PercentileTier } from "@/server/rarity/percentile";

export interface CharacterAchievement {
  key: string;
  name: string;
  /** The unlock condition, stated plainly — shown even when locked. */
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  tier: PercentileTier;
  percentile: number | null;
  isProvisional: boolean;
}

export async function getCharacterProfile(userId: string) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) throw notFound("Profile");

  const [lifeStar, rarities, myAchievements] = await Promise.all([
    getLifeStar(userId),
    getAchievementRarities(),
    db.userAchievement.findMany({ where: { userId, goalId: null } }),
  ]);

  const myByKey = new Map(myAchievements.map((a) => [a.achievementKey, a]));

  // Every achievement shows, including locked "secret" ones. The existing
  // (app)/achievements page hides secret+locked achievements client-side
  // (see its `hidden = a.secret && !a.unlocked...` check) — left untouched.
  // This page follows the new spec instead, which is explicit: a hidden
  // locked achievement "removes the reason to keep going."
  const achievements: CharacterAchievement[] = ACHIEVEMENTS.map((def) => {
      const mine = myByKey.get(def.key);
      const rarity = rarities.get(def.key)!;
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        unlocked: Boolean(mine?.unlockedAt),
        progress: mine?.progress ?? 0,
        tier: rarity.tier,
        percentile: rarity.percentile,
        isProvisional: rarity.isProvisional,
      };
    })
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return TIER_RANK(b.tier) - TIER_RANK(a.tier);
    });

  const lp = levelProgress(profile.totalXp);

  return {
    level: lp.level,
    xpIntoLevel: lp.xpIntoLevel,
    xpForThisLevel: lp.xpForThisLevel,
    xpToNextLevel: lp.xpToNextLevel,
    progressPct: lp.progressPct,
    isMaxLevel: lp.isMax,
    lifeStar,
    achievements,
  };
}

function TIER_RANK(t: PercentileTier): number {
  return PERCENTILE_TIERS.indexOf(t);
}
