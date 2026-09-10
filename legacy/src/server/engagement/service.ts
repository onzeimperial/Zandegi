import { db } from "@/lib/db";
import { notFound, HttpError } from "@/lib/errors";
import { startOfDay } from "@/lib/utils";
import { earnCoins } from "@/server/economy/coins";
import { awardXp } from "@/server/xp/engine";
import {
  questsForDay,
  questProgress,
  QUEST_BY_KEY,
  type QuestStats,
} from "./quests";

/** Aggregate today's activity once, then score every quest against it. */
export async function buildQuestStats(userId: string, day: Date): Promise<QuestStats> {
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [completions, xpAgg, milestonesCompleted] = await Promise.all([
    db.taskCompletion.findMany({
      where: { userId, completedAt: { gte: dayStart, lt: dayEnd } },
      select: {
        completedAt: true,
        minutesSpent: true,
        performance: true,
        task: { select: { goalId: true } },
      },
    }),
    db.xpEvent.aggregate({
      where: { userId, createdAt: { gte: dayStart, lt: dayEnd } },
      _sum: { amount: true },
    }),
    db.milestone.count({
      where: {
        goal: { userId },
        status: "done",
        completedAt: { gte: dayStart, lt: dayEnd },
      },
    }),
  ]);

  return {
    tasksCompleted: completions.length,
    xpEarned: Math.max(0, xpAgg._sum.amount ?? 0),
    minutesLogged: completions.reduce((a, c) => a + (c.minutesSpent ?? 0), 0),
    goalsTouched: new Set(completions.map((c) => c.task.goalId)).size,
    milestonesCompleted,
    morningTasks: completions.filter((c) => c.completedAt.getHours() < 12).length,
    highPerformanceTasks: completions.filter((c) => (c.performance ?? 0) >= 80).length,
  };
}

export interface QuestView {
  key: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  complete: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardXp: number;
}

/**
 * Today's quests with live progress. Rows are created on first read of the
 * day, then kept in sync with actual activity on every subsequent read.
 */
export async function getDailyQuests(userId: string, now: Date = new Date()): Promise<QuestView[]> {
  const day = startOfDay(now);
  const generated = questsForDay(userId, day);

  const existing = await db.dailyQuest.findMany({ where: { userId, date: day } });
  const byKey = new Map(existing.map((q) => [q.key, q]));

  // Create any missing rows for today.
  for (const g of generated) {
    if (byKey.has(g.key)) continue;
    const created = await db.dailyQuest.create({
      data: {
        userId,
        date: day,
        key: g.key,
        target: g.target,
        rewardCoins: g.rewardCoins,
        rewardXp: g.rewardXp,
      },
    });
    byKey.set(g.key, created);
  }

  const stats = await buildQuestStats(userId, day);

  const views: QuestView[] = [];
  for (const g of generated) {
    const row = byKey.get(g.key)!;
    const raw = questProgress(g.metric, stats);
    const progress = Math.min(g.target, raw);

    if (row.progress !== progress) {
      await db.dailyQuest.update({ where: { id: row.id }, data: { progress } });
    }

    views.push({
      key: g.key,
      title: g.title,
      description: g.description,
      icon: g.icon,
      target: g.target,
      progress,
      complete: progress >= g.target,
      claimed: row.claimed,
      rewardCoins: g.rewardCoins,
      rewardXp: g.rewardXp,
    });
  }

  return views;
}

/** Claim a finished quest's reward. Idempotent — a second claim is rejected. */
export async function claimQuest(userId: string, key: string, now: Date = new Date()) {
  const day = startOfDay(now);
  const row = await db.dailyQuest.findUnique({
    where: { userId_date_key: { userId, date: day, key } },
  });
  if (!row) throw notFound("Quest");
  if (row.claimed) throw new HttpError(409, "already_claimed", "You've already claimed this quest");
  if (row.progress < row.target) {
    throw new HttpError(400, "not_complete", "That quest isn't finished yet");
  }

  await db.dailyQuest.update({ where: { id: row.id }, data: { claimed: true } });

  const def = QUEST_BY_KEY.get(key);
  if (row.rewardCoins > 0) {
    await earnCoins({
      userId,
      amount: row.rewardCoins,
      source: "grant",
      meta: { questKey: key, title: def?.title ?? key },
    });
  }
  if (row.rewardXp > 0) {
    await awardXp({
      userId,
      amount: row.rewardXp,
      source: "manual",
      meta: { questKey: key },
      skipAchievements: true,
    });
  }

  return { coins: row.rewardCoins, xp: row.rewardXp };
}

/** Progress toward today's XP goal, for the dashboard ring. */
export async function getDailyGoalProgress(userId: string, now: Date = new Date()) {
  const profile = await db.profile.findUnique({ where: { userId } });
  const target = Math.max(10, profile?.dailyXpGoal ?? 50);
  const dayStart = startOfDay(now);

  const agg = await db.xpEvent.aggregate({
    where: { userId, createdAt: { gte: dayStart } },
    _sum: { amount: true },
  });
  const earned = Math.max(0, agg._sum.amount ?? 0);

  return {
    target,
    earned,
    pct: Math.min(100, Math.round((earned / target) * 100)),
    met: earned >= target,
  };
}
