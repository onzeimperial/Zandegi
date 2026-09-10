import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { clamp, startOfDay, daysBetween } from "@/lib/utils";
import { levelFromXp, levelProgress } from "./levels";
import { computeTaskXp } from "./rewards";
import { evaluateAchievements, type AchievementUnlock } from "@/server/achievements/evaluate";
import { earnCoins } from "@/server/economy/coins";
import {
  coinsForTask,
  coinsForMilestone,
  coinsForStreak,
  coinsForLevelUp,
} from "@/server/economy/rates";

export { computeTaskXp };

type Tx = Prisma.TransactionClient;

export interface AwardXpInput {
  userId: string;
  amount: number;
  source: "task_complete" | "milestone" | "streak" | "achievement" | "assessment" | "manual";
  goalId?: string | null;
  skillId?: string | null;
  taskId?: string | null;
  meta?: Record<string, unknown>;
  /** When true, skips achievement evaluation (used internally to avoid recursion). */
  skipAchievements?: boolean;
}

export interface AwardXpResult {
  awarded: number;
  coinsAwarded: number;
  coinBalance: number;
  profile: { level: number; totalXp: number; leveledUp: boolean; from: number };
  goal?: { id: string; level: number; leveledUp: boolean; from: number; progressPct: number };
  skill?: { id: string; level: number; leveledUp: boolean; from: number };
  unlocked: AchievementUnlock[];
}

/**
 * Coins earned alongside an XP award. Achievement coins are handled in
 * evaluateAchievements() instead, where the tier is known.
 */
function coinsForAward(input: AwardXpInput, amount: number): number {
  switch (input.source) {
    case "task_complete":
      return coinsForTask(amount);
    case "milestone":
      return coinsForMilestone(Number(input.meta?.orderIndex ?? 0));
    case "streak":
      return coinsForStreak(amount);
    default:
      return 0;
  }
}

/**
 * Award XP and cascade updates: XpEvent row, profile total + level,
 * goal xp/level/progress, skill xp/level, then achievement checks.
 * Everything runs in one transaction.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const amount = Math.round(input.amount);

  const result = await db.$transaction(async (tx) => {
    await tx.xpEvent.create({
      data: {
        userId: input.userId,
        goalId: input.goalId ?? null,
        skillId: input.skillId ?? null,
        taskId: input.taskId ?? null,
        source: input.source,
        amount,
        meta: input.meta ? stringifyJson(input.meta) : null,
      },
    });

    // profile
    const profile = await tx.profile.findUnique({ where: { userId: input.userId } });
    const prevTotal = profile?.totalXp ?? 0;
    const prevLevel = profile?.level ?? 1;
    const nextTotal = Math.max(0, prevTotal + amount);
    const nextLevel = levelFromXp(nextTotal);
    if (profile) {
      await tx.profile.update({
        where: { userId: input.userId },
        data: { totalXp: nextTotal, level: nextLevel },
      });
    }

    // Coins ride along in the same transaction as the XP they accompany.
    let coinsAwarded = coinsForAward(input, amount);
    if (nextLevel > prevLevel) coinsAwarded += coinsForLevelUp(nextLevel);

    let coinBalance = profile?.coins ?? 0;
    if (coinsAwarded > 0) {
      const change = await earnCoins(
        {
          userId: input.userId,
          amount: coinsAwarded,
          source: input.source === "streak" ? "streak" : input.source === "milestone" ? "milestone" : "task_complete",
          goalId: input.goalId ?? null,
          meta: { xpAmount: amount, leveledUp: nextLevel > prevLevel },
        },
        tx,
      );
      coinBalance = change.balance;
    }

    let goalOut: AwardXpResult["goal"];
    if (input.goalId) {
      const goal = await tx.goal.findUnique({ where: { id: input.goalId } });
      if (goal) {
        const gPrevLevel = goal.level;
        const gXp = Math.max(0, goal.xp + amount);
        const gLevel = levelFromXp(gXp);
        const progressPct = await computeGoalProgress(tx, goal.id);
        await tx.goal.update({
          where: { id: goal.id },
          data: { xp: gXp, level: gLevel, progressPct, lastActivityAt: new Date() },
        });
        goalOut = {
          id: goal.id,
          level: gLevel,
          leveledUp: gLevel > gPrevLevel,
          from: gPrevLevel,
          progressPct,
        };
      }
    }

    let skillOut: AwardXpResult["skill"];
    if (input.skillId) {
      const skill = await tx.skill.findUnique({ where: { id: input.skillId } });
      if (skill) {
        const sPrevLevel = skill.level;
        const sXp = Math.max(0, skill.xp + amount);
        const sLevel = levelFromXp(sXp);
        await tx.skill.update({
          where: { id: skill.id },
          data: { xp: sXp, level: sLevel, lastPracticedAt: new Date() },
        });
        skillOut = { id: skill.id, level: sLevel, leveledUp: sLevel > sPrevLevel, from: sPrevLevel };
      }
    }

    return {
      awarded: amount,
      coinsAwarded,
      coinBalance,
      profile: {
        level: nextLevel,
        totalXp: nextTotal,
        leveledUp: nextLevel > prevLevel,
        from: prevLevel,
      },
      goal: goalOut,
      skill: skillOut,
      unlocked: [] as AchievementUnlock[],
    };
  });

  // League standings track XP earned during the current week only. Failure
  // here must never block the award itself.
  if (amount > 0) {
    const { recordLeagueXp } = await import("@/server/engagement/league-service");
    await recordLeagueXp(input.userId, amount).catch(() => {});
  }

  if (result.profile.leveledUp) {
    const { logActivity } = await import("@/server/activity/service");
    await logActivity({
      userId: input.userId,
      kind: "level_up",
      title: `Reached level ${result.profile.level}`,
    });
  }

  if (!input.skipAchievements) {
    result.unlocked = await evaluateAchievements(input.userId, { goalId: input.goalId ?? undefined });
  }
  return result;
}

/** Weighted progress: milestones done + skill mastery + metric progress. */
export async function computeGoalProgress(tx: Tx, goalId: string): Promise<number> {
  const [milestones, skills, goal] = await Promise.all([
    tx.milestone.findMany({ where: { goalId } }),
    tx.skill.findMany({ where: { goalId } }),
    tx.goal.findUnique({ where: { id: goalId } }),
  ]);

  const parts: Array<{ value: number; weight: number }> = [];

  if (milestones.length) {
    const done = milestones.filter((m) => m.status === "done").length;
    parts.push({ value: (done / milestones.length) * 100, weight: 0.5 });
  }
  if (skills.length) {
    const avgMastery = skills.reduce((a, s) => a + s.mastery, 0) / skills.length;
    parts.push({ value: avgMastery, weight: 0.3 });
  }
  if (goal?.metricStart != null && goal.metricTarget != null && goal.metricCurrent != null) {
    const span = goal.metricTarget - goal.metricStart;
    if (span !== 0) {
      const p = ((goal.metricCurrent - goal.metricStart) / span) * 100;
      parts.push({ value: clamp(p, 0, 100), weight: 0.2 });
    }
  }

  if (!parts.length) {
    // fall back to level ratio
    if (goal) {
      const lp = levelProgress(goal.xp);
      const span = Math.max(1, goal.targetLevel - goal.startLevel);
      return clamp(Math.round(((lp.level - goal.startLevel) / span) * 100), 0, 100);
    }
    return 0;
  }

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const weighted = parts.reduce((a, p) => a + p.value * p.weight, 0) / totalWeight;
  return clamp(Math.round(weighted), 0, 100);
}

/**
 * Update the user's activity streak for a given day. Idempotent per day.
 * Returns the streak state and any bonus XP that should be awarded.
 */
export async function recordActivity(userId: string, when: Date = new Date()) {
  const today = startOfDay(when);

  // Spend a freeze first if a day was missed, so the gap below reads as
  // consecutive and the streak survives.
  const { applyFreezeIfMissed } = await import("@/server/engagement/streak");
  const freeze = await applyFreezeIfMissed(userId, when).catch(() => ({ used: false }));

  const streak = await db.streak.upsert({
    where: { userId },
    create: { userId, current: 1, longest: 1, lastActiveDate: today },
    update: {},
  });

  if (streak.lastActiveDate && daysBetween(streak.lastActiveDate, today) === 0) {
    return {
      current: streak.current,
      longest: streak.longest,
      changed: false,
      bonusXp: 0,
      freezeUsed: freeze.used,
    };
  }

  let current = 1;
  if (streak.lastActiveDate && daysBetween(streak.lastActiveDate, today) === 1) {
    current = streak.current + 1;
  }
  const longest = Math.max(streak.longest, current);
  await db.streak.update({
    where: { userId },
    data: { current, longest, lastActiveDate: today },
  });

  // Streak milestone bonuses
  const bonusTable: Record<number, number> = { 3: 50, 7: 150, 14: 300, 30: 750, 100: 3000 };
  const bonusXp = bonusTable[current] ?? 0;
  if (bonusXp > 0) {
    await awardXp({
      userId,
      amount: bonusXp,
      source: "streak",
      meta: { streakDay: current },
      skipAchievements: true,
    });
  }

  return { current, longest, changed: true, bonusXp, freezeUsed: freeze.used };
}
