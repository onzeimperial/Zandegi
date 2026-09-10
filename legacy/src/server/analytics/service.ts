import { db } from "@/lib/db";
import { startOfDay } from "@/lib/utils";
import { subDays, format } from "date-fns";

/** Aggregated analytics across all of a user's goals. Meaningful metrics only. */
export async function getAnalytics(userId: string, days = 30) {
  const from = startOfDay(subDays(new Date(), days - 1));

  const [completions, xpEvents, goals, skills, streak, totalCompletions, totalTasks] = await Promise.all([
    db.taskCompletion.findMany({
      where: { userId, completedAt: { gte: from } },
      select: { completedAt: true, minutesSpent: true, performance: true, xpAwarded: true, task: { select: { goalId: true } } },
    }),
    db.xpEvent.findMany({ where: { userId, createdAt: { gte: from } }, select: { createdAt: true, amount: true, source: true } }),
    db.goal.findMany({
      where: { userId },
      select: { id: true, title: true, category: true, status: true, progressPct: true, difficulty: true, startedAt: true, level: true },
    }),
    db.skill.findMany({
      where: { goal: { userId } },
      select: { name: true, mastery: true, confidence: true, goal: { select: { title: true } } },
      orderBy: { mastery: "asc" },
    }),
    db.streak.findUnique({ where: { userId } }),
    db.taskCompletion.count({ where: { userId } }),
    db.task.count({ where: { goal: { userId } } }),
  ]);

  // daily buckets
  const buckets = new Map<string, { date: string; tasks: number; minutes: number; xp: number }>();
  for (let i = 0; i < days; i++) {
    const d = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
    buckets.set(d, { date: d, tasks: 0, minutes: 0, xp: 0 });
  }
  for (const c of completions) {
    const k = format(c.completedAt, "yyyy-MM-dd");
    const b = buckets.get(k);
    if (b) {
      b.tasks += 1;
      b.minutes += c.minutesSpent ?? 0;
      b.xp += c.xpAwarded;
    }
  }
  for (const e of xpEvents) {
    const k = format(e.createdAt, "yyyy-MM-dd");
    const b = buckets.get(k);
    if (b && e.source !== "task_complete") b.xp += e.amount;
  }
  const daily = [...buckets.values()];

  const activeDays = daily.filter((d) => d.tasks > 0).length;
  const totalMinutes = completions.reduce((a, c) => a + (c.minutesSpent ?? 0), 0);
  const perfSamples = completions.map((c) => c.performance).filter((p): p is number => p != null);
  const avgPerformance = perfSamples.length ? Math.round(perfSamples.reduce((a, b) => a + b, 0) / perfSamples.length) : null;

  const xpBySource = xpEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + e.amount;
    return acc;
  }, {});

  // goal velocity: progress% per week since start
  const goalVelocity = goals
    .filter((g) => g.status === "active")
    .map((g) => {
      const weeks = Math.max(1, (Date.now() - g.startedAt.getTime()) / (7 * 864e5));
      return { id: g.id, title: g.title, category: g.category, progressPct: Math.round(g.progressPct), perWeek: +(g.progressPct / weeks).toFixed(1), difficulty: g.difficulty };
    });

  return {
    range: { days, from: format(from, "yyyy-MM-dd") },
    totals: {
      tasksCompleted: totalCompletions,
      tasksOutstanding: Math.max(0, totalTasks - totalCompletions),
      minutes: totalMinutes,
      activeDays,
      consistencyPct: Math.round((activeDays / days) * 100),
      avgPerformance,
      streakCurrent: streak?.current ?? 0,
      streakLongest: streak?.longest ?? 0,
    },
    daily,
    xpBySource,
    goalVelocity,
    weakestSkills: skills.slice(0, 6).map((s) => ({ name: s.name, goal: s.goal.title, mastery: Math.round(s.mastery), confidence: Math.round(s.confidence) })),
    strongestSkills: skills.slice(-6).reverse().map((s) => ({ name: s.name, goal: s.goal.title, mastery: Math.round(s.mastery), confidence: Math.round(s.confidence) })),
    goals: goals.map((g) => ({ id: g.id, title: g.title, category: g.category, status: g.status, progressPct: Math.round(g.progressPct), level: g.level })),
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;
