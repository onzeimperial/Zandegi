import { db } from "@/lib/db";
import { notFound, forbidden, HttpError } from "@/lib/errors";
import { clamp, startOfDay } from "@/lib/utils";
import { awardXp, computeTaskXp, recordActivity, computeGoalProgress } from "@/server/xp/engine";
import { evaluateAchievements } from "@/server/achievements/evaluate";
import { recomputeGoalPlan } from "@/server/planning/adaptive";
import { earnCoins, getBalance } from "@/server/economy/coins";
import { coinsForGoalCompletion } from "@/server/economy/rates";
import {
  awardGoalCompletionDrop,
  awardMilestoneDrop,
  type AwardedDrop,
} from "@/server/cosmetics/service";
import { seedCosmeticsIfNeeded } from "@/server/cosmetics/seed-runtime";
import { logActivity } from "@/server/activity/service";
import { addDays } from "date-fns";

export async function getOwnedTask(userId: string, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { goal: { select: { userId: true, status: true } } },
  });
  if (!task) throw notFound("Task");
  if (task.goal.userId !== userId) throw forbidden();
  return task;
}

export interface CompleteTaskInput {
  userId: string;
  taskId: string;
  minutesSpent?: number | null;
  performance?: number | null; // 0..100
  note?: string | null;
}

export interface CompleteTaskResult {
  taskId: string;
  xpAwarded: number;
  levelUp: boolean;
  newLevel: number;
  goalProgressPct: number | null;
  streak: { current: number; longest: number; bonusXp: number };
  milestoneCompleted: { id: string; title: string } | null;
  unlockedAchievements: { key: string; name: string; tier: string; xpReward: number }[];
  nextOccurrenceId: string | null;
  coinsAwarded: number;
  coinBalance: number;
  goalCompleted: boolean;
  /** Cosmetics gifted by this completion, for the reward reveal. */
  drops: AwardedDrop[];
}

/**
 * Complete a task: record completion, award XP (scaled by difficulty/perf),
 * bump skill mastery, update streak, spawn the next recurrence, auto-complete
 * the parent milestone when all its tasks are done, then re-evaluate
 * achievements and re-plan the goal.
 */
export async function completeTask(input: CompleteTaskInput): Promise<CompleteTaskResult> {
  const task = await getOwnedTask(input.userId, input.taskId);
  if (task.status === "done") throw new HttpError(409, "already_done", "Task already completed");

  const onTime = task.dueDate ? new Date() <= task.dueDate : true;
  const xp = computeTaskXp({
    baseReward: task.xpReward,
    difficulty: task.difficulty,
    performance: input.performance ?? null,
    onTime,
  });

  const completion = await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: "done", completedAt: new Date(), notes: input.note ?? task.notes },
    });

    const c = await tx.taskCompletion.create({
      data: {
        taskId: task.id,
        userId: input.userId,
        minutesSpent: input.minutesSpent ?? task.estimatedMinutes,
        performance: input.performance ?? null,
        note: input.note ?? null,
        xpAwarded: xp,
      },
    });

    // Skill mastery: exponential moving average toward recent performance.
    if (task.skillId) {
      const skill = await tx.skill.findUnique({ where: { id: task.skillId } });
      if (skill) {
        const signal = input.performance ?? 55 + task.difficulty * 6; // no self-rating -> assume decent
        const nextMastery = clamp(skill.mastery * 0.8 + signal * 0.2, 0, 100);
        const nextConfidence = clamp(skill.confidence * 0.85 + signal * 0.15, 0, 100);
        await tx.skill.update({
          where: { id: skill.id },
          data: {
            mastery: nextMastery,
            confidence: nextConfidence,
            recentPerf: signal,
            lastPracticedAt: new Date(),
          },
        });
      }
    }

    return c;
  });

  // XP cascade (own transaction inside)
  const award = await awardXp({
    userId: input.userId,
    amount: xp,
    source: "task_complete",
    goalId: task.goalId,
    skillId: task.skillId,
    taskId: task.id,
    meta: { completionId: completion.id, performance: input.performance ?? null },
    skipAchievements: true,
  });

  const streak = await recordActivity(input.userId);

  await seedCosmeticsIfNeeded();
  const drops: AwardedDrop[] = [];
  let goalCompleted = false;

  // Milestone auto-completion
  let milestoneCompleted: CompleteTaskResult["milestoneCompleted"] = null;
  if (task.milestoneId) {
    const remaining = await db.task.count({
      where: { milestoneId: task.milestoneId, status: { notIn: ["done", "skipped"] } },
    });
    if (remaining === 0) {
      const ms = await db.milestone.update({
        where: { id: task.milestoneId },
        data: { status: "done", completedAt: new Date() },
      });
      milestoneCompleted = { id: ms.id, title: ms.title };
      await awardXp({
        userId: input.userId,
        amount: ms.xpReward,
        source: "milestone",
        goalId: task.goalId,
        meta: { milestoneId: ms.id, orderIndex: ms.orderIndex },
        skipAchievements: true,
      });
      await db.notification.create({
        data: {
          userId: input.userId,
          type: "milestone",
          title: `Milestone complete: ${ms.title}`,
          body: `+${ms.xpReward} XP`,
          href: `/goals/${task.goalId}`,
        },
      });
      const msDrop = await awardMilestoneDrop({
        userId: input.userId,
        goalId: task.goalId,
        milestoneId: ms.id,
      });
      if (msDrop) drops.push(msDrop);

      const msGoal = await db.goal.findUnique({ where: { id: task.goalId }, select: { title: true } });
      await logActivity({
        userId: input.userId,
        kind: "milestone_complete",
        title: `Completed a milestone: ${ms.title}${msGoal ? ` on ${msGoal.title}` : ""}`,
      });

      // unlock the next milestone
      const next = await db.milestone.findFirst({
        where: { goalId: task.goalId, status: "locked" },
        orderBy: { orderIndex: "asc" },
      });
      if (next) await db.milestone.update({ where: { id: next.id }, data: { status: "active" } });
    }
  }

  // Recurrence: spawn the next occurrence
  let nextOccurrenceId: string | null = null;
  if (task.recurrenceRule && (!task.recurrenceUntil || new Date() < task.recurrenceUntil)) {
    const freq = /FREQ=WEEKLY/i.test(task.recurrenceRule) ? 7 : /FREQ=MONTHLY/i.test(task.recurrenceRule) ? 30 : 1;
    const base = task.scheduledFor ?? startOfDay();
    const next = await db.task.create({
      data: {
        goalId: task.goalId,
        skillId: task.skillId,
        milestoneId: task.milestoneId,
        title: task.title,
        description: task.description,
        type: task.type,
        difficulty: task.difficulty,
        estimatedMinutes: task.estimatedMinutes,
        priority: task.priority,
        orderIndex: task.orderIndex,
        recurrenceRule: task.recurrenceRule,
        recurrenceUntil: task.recurrenceUntil,
        xpReward: task.xpReward,
        aiGenerated: task.aiGenerated,
        scheduledFor: addDays(base, freq),
      },
    });
    nextOccurrenceId = next.id;
  }

  // Goal completion check
  const freshProgress = await db.$transaction((tx) => computeGoalProgress(tx, task.goalId));
  if (freshProgress >= 100) {
    const openMs = await db.milestone.count({ where: { goalId: task.goalId, status: { not: "done" } } });
    if (openMs === 0) {
      const goal = await db.goal.update({
        where: { id: task.goalId },
        data: { status: "completed", completedAt: new Date(), progressPct: 100 },
      });
      // Only pay out the first time a goal crosses the finish line.
      if (task.goal.status !== "completed") {
        goalCompleted = true;
        await earnCoins({
          userId: input.userId,
          amount: coinsForGoalCompletion(goal.difficulty),
          source: "goal_complete",
          goalId: goal.id,
          meta: { title: goal.title },
        });
        const goalDrop = await awardGoalCompletionDrop({
          userId: input.userId,
          goalId: goal.id,
        });
        if (goalDrop) drops.push(goalDrop);

        await logActivity({
          userId: input.userId,
          kind: "goal_complete",
          title: `Finished: ${goal.title}`,
        });
      }
    }
  }

  const unlocked = await evaluateAchievements(input.userId, { goalId: task.goalId });
  await recomputeGoalPlan(task.goalId).catch(() => {});

  return {
    taskId: task.id,
    xpAwarded: xp + (milestoneCompleted ? 0 : 0),
    levelUp: award.profile.leveledUp,
    newLevel: award.profile.level,
    goalProgressPct: award.goal?.progressPct ?? freshProgress,
    streak: { current: streak.current, longest: streak.longest, bonusXp: streak.bonusXp },
    milestoneCompleted,
    unlockedAchievements: unlocked.map((u) => ({ key: u.key, name: u.name, tier: u.tier, xpReward: u.xpReward })),
    nextOccurrenceId,
    coinsAwarded: award.coinsAwarded,
    coinBalance: await getBalance(input.userId),
    goalCompleted,
    drops,
  };
}

/** Tasks scheduled for today (or overdue) + recurring dailies, across all active goals. */
export async function getTodayQueue(userId: string) {
  const endOfToday = startOfDay();
  endOfToday.setHours(23, 59, 59, 999);

  return db.task.findMany({
    where: {
      goal: { userId, status: "active" },
      status: { in: ["todo", "in_progress"] },
      OR: [
        { scheduledFor: { lte: endOfToday } },
        { scheduledFor: null, dueDate: { lte: endOfToday } },
        { type: "daily" },
      ],
    },
    include: { goal: { select: { id: true, title: true, category: true } }, skill: { select: { name: true } } },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { orderIndex: "asc" }],
    take: 25,
  });
}
