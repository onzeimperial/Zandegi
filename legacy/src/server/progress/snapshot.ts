import { db } from "@/lib/db";
import { startOfDay } from "@/lib/utils";

/**
 * Upsert a per-day progress snapshot for a user (and optionally per goal).
 * Idempotent — safe to call on every meaningful action. Powers analytics
 * trend lines and velocity without expensive historical aggregation.
 */
export async function captureSnapshot(userId: string, goalId: string | null = null) {
  const date = startOfDay();
  const dayStart = date;
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [profile, goal, completionsToday, minutesAgg, streak, trailing] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    goalId ? db.goal.findUnique({ where: { id: goalId } }) : Promise.resolve(null),
    db.taskCompletion.count({
      where: { userId, completedAt: { gte: dayStart, lte: dayEnd }, ...(goalId ? { task: { goalId } } : {}) },
    }),
    db.taskCompletion.aggregate({
      where: { userId, completedAt: { gte: dayStart, lte: dayEnd }, ...(goalId ? { task: { goalId } } : {}) },
      _sum: { minutesSpent: true },
    }),
    db.streak.findUnique({ where: { userId } }),
    db.progressSnapshot.findMany({
      where: { userId, goalId: goalId ?? null },
      orderBy: { date: "desc" },
      take: 7,
    }),
  ]);

  const xp = goalId ? (goal?.xp ?? 0) : (profile?.totalXp ?? 0);
  const level = goalId ? (goal?.level ?? 1) : (profile?.level ?? 1);
  const progressPct = goalId ? (goal?.progressPct ?? 0) : 0;

  // velocity = trailing 7-day average XP gained per day
  const oldest = trailing[trailing.length - 1];
  const spanDays = oldest ? Math.max(1, Math.round((date.getTime() - oldest.date.getTime()) / 864e5)) : 1;
  const velocity = oldest ? Math.max(0, (xp - oldest.xp) / spanDays) : 0;

  const values = {
    xp,
    level,
    tasksCompleted: completionsToday,
    minutesSpent: minutesAgg._sum.minutesSpent ?? 0,
    streakDays: streak?.current ?? 0,
    progressPct,
    velocity,
  };

  // Not an upsert: Prisma rejects null inside a composite unique `where`,
  // and goalId is null for whole-account snapshots.
  const existing = await db.progressSnapshot.findFirst({
    where: { userId, goalId: goalId ?? null, date },
    select: { id: true },
  });

  return existing
    ? db.progressSnapshot.update({ where: { id: existing.id }, data: values })
    : db.progressSnapshot.create({ data: { userId, goalId: goalId ?? null, date, ...values } });
}
