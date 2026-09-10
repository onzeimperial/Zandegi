import { db } from "@/lib/db";
import { ACHIEVEMENTS, type AchievementStats } from "./definitions";
import { earnCoins } from "@/server/economy/coins";
import { coinsForAchievement } from "@/server/economy/rates";
import { logActivity } from "@/server/activity/service";

export interface AchievementUnlock {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  xpReward: number;
}

/** Build the stats snapshot the achievement checks run against. */
export async function buildAchievementStats(userId: string): Promise<AchievementStats> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [
    profile,
    streak,
    tasksCompleted,
    tasksToday,
    goalsActive,
    goalsCompleted,
    milestonesCompleted,
    skillsMastered,
    goalCats,
    friends,
    challengesWon,
    minutesAgg,
    completions,
  ] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.streak.findUnique({ where: { userId } }),
    db.taskCompletion.count({ where: { userId } }),
    db.taskCompletion.count({ where: { userId, completedAt: { gte: dayStart } } }),
    db.goal.count({ where: { userId, status: "active" } }),
    db.goal.count({ where: { userId, status: "completed" } }),
    db.milestone.count({ where: { goal: { userId }, status: "done" } }),
    db.skill.count({ where: { goal: { userId }, mastery: { gte: 80 } } }),
    db.goal.findMany({ where: { userId, status: "active" }, select: { category: true } }),
    db.friendship.count({ where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
    db.challengeParticipant.count({ where: { userId /* win detection is coarse for now */ } }).then(() => 0),
    db.taskCompletion.aggregate({ where: { userId }, _sum: { minutesSpent: true } }),
    db.taskCompletion.findMany({ where: { userId }, select: { completedAt: true } }),
  ]);

  const distinctGoalCategories = new Set(goalCats.map((g) => g.category)).size;
  const earlyBirdCompletions = completions.filter((c) => c.completedAt.getHours() < 9).length;
  const nightOwlCompletions = completions.filter((c) => c.completedAt.getHours() >= 22).length;

  return {
    totalXp: profile?.totalXp ?? 0,
    level: profile?.level ?? 1,
    streakCurrent: streak?.current ?? 0,
    streakLongest: streak?.longest ?? 0,
    tasksCompleted,
    tasksCompletedToday: tasksToday,
    goalsActive,
    goalsCompleted,
    milestonesCompleted,
    skillsMastered,
    distinctGoalCategories,
    friends,
    challengesWon,
    minutesLogged: minutesAgg._sum.minutesSpent ?? 0,
    perfectWeeks: 0,
    earlyBirdCompletions,
    nightOwlCompletions,
  };
}

/**
 * Re-evaluate every achievement for a user. Upserts progress rows and,
 * for anything newly hitting 100%, marks it unlocked and awards its XP.
 * Safe to call after any progress-changing action.
 */
export async function evaluateAchievements(
  userId: string,
  _opts?: { goalId?: string },
): Promise<AchievementUnlock[]> {
  const stats = await buildAchievementStats(userId);
  const existing = await db.userAchievement.findMany({ where: { userId, goalId: null } });
  const byKey = new Map(existing.map((e) => [e.achievementKey, e]));

  const unlocked: AchievementUnlock[] = [];

  for (const def of ACHIEVEMENTS) {
    const progress = Math.max(0, Math.min(100, Math.round(def.check(stats))));
    const prev = byKey.get(def.key);

    if (prev?.unlockedAt) {
      if (prev.progress !== 100) {
        await db.userAchievement.update({ where: { id: prev.id }, data: { progress: 100 } });
      }
      continue;
    }

    const nowUnlocked = progress >= 100;
    const unlockedAt = nowUnlocked ? new Date() : null;
    // Not an upsert: Prisma rejects null inside a composite unique `where`,
    // and goalId is nullable here. `prev` already tells us which branch to take.
    if (prev) {
      await db.userAchievement.update({
        where: { id: prev.id },
        data: { progress, unlockedAt },
      });
    } else {
      await db.userAchievement.create({
        data: { userId, achievementKey: def.key, goalId: null, progress, unlockedAt },
      });
    }

    if (nowUnlocked) {
      unlocked.push({
        key: def.key,
        name: def.name,
        description: def.description,
        icon: def.icon,
        tier: def.tier,
        xpReward: def.xpReward,
      });
      await db.xpEvent.create({
        data: { userId, source: "achievement", amount: def.xpReward, meta: JSON.stringify({ achievement: def.key }) },
      });
      const p = await db.profile.findUnique({ where: { userId } });
      if (p) {
        const { levelFromXp } = await import("@/server/xp/levels");
        const total = p.totalXp + def.xpReward;
        await db.profile.update({ where: { userId }, data: { totalXp: total, level: levelFromXp(total) } });
      }
      await earnCoins({
        userId,
        amount: coinsForAchievement(def.tier),
        source: "achievement",
        meta: { achievement: def.key, tier: def.tier },
      });
      await logActivity({
        userId,
        kind: "achievement_unlock",
        title: `Unlocked: ${def.name}`,
      });
      await db.notification.create({
        data: {
          userId,
          type: "achievement",
          title: `Achievement unlocked: ${def.name}`,
          body: def.description,
          href: "/dashboard",
        },
      });
    }
  }

  return unlocked;
}
