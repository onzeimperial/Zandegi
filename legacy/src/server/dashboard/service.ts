import { db } from "@/lib/db";
import { levelProgress } from "@/server/xp/levels";
import { getTodayQueue } from "@/server/tasks/service";
import { startOfDay } from "@/lib/utils";

/** Everything the dashboard needs in one round-trip. */
export async function getDashboard(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const dayStart = startOfDay();

  const [profile, streak, todayQueue, doneToday, activeGoals, recentAchievements, recos, weekCompletions, weekXp, notifications, snapshots] =
    await Promise.all([
      db.profile.findUnique({ where: { userId } }),
      db.streak.findUnique({ where: { userId } }),
      getTodayQueue(userId),
      db.taskCompletion.count({ where: { userId, completedAt: { gte: dayStart } } }),
      db.goal.findMany({
        where: { userId, status: "active" },
        orderBy: { lastActivityAt: "desc" },
        include: {
          milestones: { where: { status: { in: ["active", "done"] } }, orderBy: { orderIndex: "asc" } },
          _count: { select: { tasks: { where: { status: { in: ["todo", "in_progress"] } } } } },
        },
      }),
      db.userAchievement.findMany({
        where: { userId, unlockedAt: { not: null } },
        orderBy: { unlockedAt: "desc" },
        take: 5,
        include: { achievement: true },
      }),
      db.aiRecommendation.findMany({
        where: { userId, status: { in: ["new", "seen"] } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 6,
        include: { goal: { select: { id: true, title: true } } },
      }),
      db.taskCompletion.count({ where: { userId, completedAt: { gte: weekAgo } } }),
      db.xpEvent.aggregate({ where: { userId, createdAt: { gte: weekAgo } }, _sum: { amount: true } }),
      db.notification.findMany({ where: { userId, read: false }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.progressSnapshot.findMany({ where: { userId, goalId: null }, orderBy: { date: "desc" }, take: 30 }),
    ]);

  const lp = levelProgress(profile?.totalXp ?? 0);
  const today = dayStart;

  const nextUpcomingMilestone = activeGoals
    .flatMap((g) => g.milestones.filter((m) => m.status === "active").map((m) => ({ ...m, goalTitle: g.title, goalId: g.id })))
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0] ?? null;

  return {
    profile: {
      displayName: profile?.displayName ?? "there",
      avatarColor: profile?.avatarColor ?? "#6366f1",
      dailyMinutes: profile?.dailyMinutes ?? 45,
    },
    level: lp,
    streak: { current: streak?.current ?? 0, longest: streak?.longest ?? 0, activeToday: streak?.lastActiveDate ? startOfDay(streak.lastActiveDate).getTime() === today.getTime() : false },
    today: {
      queue: todayQueue.map((t) => ({
        id: t.id,
        title: t.title,
        goalId: t.goal.id,
        goalTitle: t.goal.title,
        category: t.goal.category,
        skill: t.skill?.name ?? null,
        priority: t.priority,
        type: t.type,
        estimatedMinutes: t.estimatedMinutes,
        xpReward: t.xpReward,
        status: t.status,
        dueDate: t.dueDate,
      })),
      completed: doneToday,
      total: todayQueue.length,
    },
    goals: activeGoals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      level: g.level,
      progressPct: Math.round(g.progressPct),
      difficulty: g.difficulty,
      openTasks: g._count.tasks,
      targetDate: g.targetDate,
      decompositionStatus: g.decompositionStatus,
    })),
    nextMilestone: nextUpcomingMilestone
      ? { title: nextUpcomingMilestone.title, goalTitle: nextUpcomingMilestone.goalTitle, goalId: nextUpcomingMilestone.goalId, dueDate: nextUpcomingMilestone.dueDate }
      : null,
    recentAchievements: recentAchievements.map((ua) => ({
      key: ua.achievementKey,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      tier: ua.achievement.tier,
      unlockedAt: ua.unlockedAt,
    })),
    recommendations: recos.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      priority: r.priority,
      goal: r.goal,
    })),
    week: {
      tasksCompleted: weekCompletions,
      xpEarned: weekXp._sum.amount ?? 0,
    },
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt })),
    trajectory: snapshots
      .slice()
      .reverse()
      .map((s) => ({ date: s.date.toISOString().slice(0, 10), xp: s.xp, level: s.level, minutes: s.minutesSpent, tasks: s.tasksCompleted })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
