import { db } from "@/lib/db";
import { levelProgress } from "@/server/xp/levels";
import { startOfDay } from "@/lib/utils";

/**
 * Assembles a compact, read-only snapshot of a user's real data for the coach.
 * Scoped strictly to `userId` — the coach can never see another user's data.
 */
export async function buildCoachContext(userId: string, goalId?: string) {
  const since = new Date(Date.now() - 14 * 864e5);

  const [profile, streak, goals, recentCompletions, upcomingTasks, snapshots, openRecos] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.streak.findUnique({ where: { userId } }),
    db.goal.findMany({
      where: { userId, status: { in: goalId ? ["active", "paused", "completed"] : ["active"] }, ...(goalId ? { id: goalId } : {}) },
      include: {
        skills: { orderBy: { orderIndex: "asc" } },
        milestones: { orderBy: { orderIndex: "asc" } },
        tasks: { where: { status: { in: ["todo", "in_progress"] } }, orderBy: [{ priority: "desc" }, { dueDate: "asc" }], take: 12 },
      },
    }),
    db.taskCompletion.findMany({
      where: { userId, completedAt: { gte: since } },
      include: { task: { select: { title: true, goalId: true, skillId: true, difficulty: true } } },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),
    db.task.findMany({
      where: { goal: { userId }, status: { in: ["todo", "in_progress"] }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 10,
      select: { title: true, dueDate: true, goalId: true, priority: true },
    }),
    db.progressSnapshot.findMany({ where: { userId, goalId: goalId ?? null }, orderBy: { date: "desc" }, take: 14 }),
    db.aiRecommendation.findMany({ where: { userId, status: { in: ["new", "seen"] } }, orderBy: { priority: "asc" }, take: 6 }),
  ]);

  const today = startOfDay();
  const completionsByDay = new Map<string, number>();
  for (const c of recentCompletions) {
    const k = startOfDay(c.completedAt).toISOString().slice(0, 10);
    completionsByDay.set(k, (completionsByDay.get(k) ?? 0) + 1);
  }

  const lp = levelProgress(profile?.totalXp ?? 0);

  return {
    now: today.toISOString().slice(0, 10),
    account: {
      level: lp.level,
      totalXp: lp.xp,
      xpToNextLevel: lp.xpToNextLevel,
      dailyMinutes: profile?.dailyMinutes ?? 45,
      weeklyDays: profile?.weeklyDays ?? 5,
      timezone: profile?.timezone ?? "UTC",
    },
    streak: { current: streak?.current ?? 0, longest: streak?.longest ?? 0, lastActive: streak?.lastActiveDate?.toISOString().slice(0, 10) ?? null },
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      status: g.status,
      difficulty: g.difficulty,
      level: g.level,
      progressPct: g.progressPct,
      timelineWeeks: g.timelineWeeks,
      targetDate: g.targetDate?.toISOString().slice(0, 10) ?? null,
      startedAt: g.startedAt.toISOString().slice(0, 10),
      metric: g.metricName ? { name: g.metricName, start: g.metricStart, target: g.metricTarget, current: g.metricCurrent } : null,
      milestones: g.milestones.map((m) => ({ title: m.title, status: m.status, targetLevel: m.targetLevel, dueDate: m.dueDate?.toISOString().slice(0, 10) ?? null })),
      skills: g.skills.map((s) => ({ name: s.name, level: s.level, mastery: Math.round(s.mastery), confidence: Math.round(s.confidence), lastPracticed: s.lastPracticedAt?.toISOString().slice(0, 10) ?? null })),
      openTasks: g.tasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority, type: t.type, dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null, skillId: t.skillId })),
    })),
    recentActivity: {
      completionsLast14Days: recentCompletions.length,
      activeDaysLast14: completionsByDay.size,
      byDay: Object.fromEntries(completionsByDay),
      lastCompleted: recentCompletions.slice(0, 8).map((c) => ({ title: c.task?.title, at: c.completedAt.toISOString().slice(0, 10), performance: c.performance })),
    },
    upcomingDeadlines: upcomingTasks.map((t) => ({ title: t.title, dueDate: t.dueDate?.toISOString().slice(0, 10), priority: t.priority })),
    trajectory: snapshots
      .slice()
      .reverse()
      .map((s) => ({ date: s.date.toISOString().slice(0, 10), xp: s.xp, progressPct: s.progressPct, velocity: s.velocity })),
    openRecommendations: openRecos.map((r) => ({ kind: r.kind, title: r.title })),
  };
}

export type CoachContext = Awaited<ReturnType<typeof buildCoachContext>>;
