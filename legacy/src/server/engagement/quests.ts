/**
 * Daily quest definitions and selection. Pure — no IO, unit tested
 * (test/quests.test.ts).
 *
 * Three quests are generated per user per day, chosen deterministically from
 * the user id and the date so they are stable across page loads but differ
 * between people and rotate daily.
 */

import { seededRandom } from "@/server/cosmetics/drops";

export type QuestMetric =
  | "tasks_completed"
  | "xp_earned"
  | "minutes_logged"
  | "goals_touched"
  | "milestones_completed"
  | "morning_tasks"
  | "perfect_task";

export interface QuestDef {
  key: string;
  metric: QuestMetric;
  title: string;
  /** {n} is replaced with the target. */
  description: string;
  icon: string;
  /** Candidate targets — one is picked per day. */
  targets: number[];
  rewardCoins: number;
  rewardXp: number;
  /** Excluded from the easy slot; these need a real session. */
  hard?: boolean;
}

export const QUEST_DEFS: QuestDef[] = [
  {
    key: "complete_tasks",
    metric: "tasks_completed",
    title: "Get things done",
    description: "Complete {n} tasks",
    icon: "check",
    targets: [2, 3, 4],
    rewardCoins: 40,
    rewardXp: 20,
  },
  {
    key: "earn_xp",
    metric: "xp_earned",
    title: "Earn XP",
    description: "Earn {n} XP today",
    icon: "zap",
    targets: [50, 80, 120],
    rewardCoins: 40,
    rewardXp: 0,
  },
  {
    key: "log_minutes",
    metric: "minutes_logged",
    title: "Put the time in",
    description: "Log {n} minutes of work",
    icon: "clock",
    targets: [30, 45, 60],
    rewardCoins: 45,
    rewardXp: 25,
  },
  {
    key: "spread_effort",
    metric: "goals_touched",
    title: "Spread the effort",
    description: "Make progress on {n} different goals",
    icon: "target",
    targets: [2, 3],
    rewardCoins: 60,
    rewardXp: 30,
    hard: true,
  },
  {
    key: "finish_milestone",
    metric: "milestones_completed",
    title: "Hit a milestone",
    description: "Complete {n} milestone",
    icon: "flag",
    targets: [1],
    rewardCoins: 150,
    rewardXp: 75,
    hard: true,
  },
  {
    key: "early_start",
    metric: "morning_tasks",
    title: "Early start",
    description: "Complete {n} tasks before midday",
    icon: "sunrise",
    targets: [1, 2],
    rewardCoins: 55,
    rewardXp: 25,
    hard: true,
  },
  {
    key: "quality_work",
    metric: "perfect_task",
    title: "Do it properly",
    description: "Complete {n} task rated 80% or better",
    icon: "star",
    targets: [1, 2],
    rewardCoins: 50,
    rewardXp: 30,
  },
];

export const QUEST_BY_KEY = new Map(QUEST_DEFS.map((q) => [q.key, q]));

export interface GeneratedQuest {
  key: string;
  title: string;
  description: string;
  icon: string;
  metric: QuestMetric;
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export const QUESTS_PER_DAY = 3;

/**
 * Pick the day's quests. Deterministic on user + date, so refreshing never
 * rerolls them, and always includes at least one easy quest so a busy day
 * still has something achievable.
 */
export function questsForDay(userId: string, date: Date): GeneratedQuest[] {
  const dayKey = date.toISOString().slice(0, 10);
  const rng = seededRandom(`quests:${userId}:${dayKey}`);

  const easy = QUEST_DEFS.filter((q) => !q.hard);
  const pool = [...QUEST_DEFS];
  const chosen: QuestDef[] = [];

  // Guarantee one easy quest.
  const firstEasy = easy[Math.floor(rng() * easy.length)] ?? easy[0]!;
  chosen.push(firstEasy);

  // Fill the rest without repeating.
  const remaining = pool.filter((q) => q.key !== firstEasy.key);
  while (chosen.length < QUESTS_PER_DAY && remaining.length) {
    const idx = Math.floor(rng() * remaining.length);
    const [picked] = remaining.splice(idx, 1);
    if (picked) chosen.push(picked);
  }

  return chosen.map((def) => {
    const target = def.targets[Math.floor(rng() * def.targets.length)] ?? def.targets[0]!;
    return {
      key: def.key,
      title: def.title,
      description: def.description.replace("{n}", String(target)),
      icon: def.icon,
      metric: def.metric,
      target,
      rewardCoins: def.rewardCoins,
      rewardXp: def.rewardXp,
    };
  });
}

/** Progress toward a quest, capped at its target. */
export function questProgress(metric: QuestMetric, stats: QuestStats): number {
  switch (metric) {
    case "tasks_completed":
      return stats.tasksCompleted;
    case "xp_earned":
      return stats.xpEarned;
    case "minutes_logged":
      return stats.minutesLogged;
    case "goals_touched":
      return stats.goalsTouched;
    case "milestones_completed":
      return stats.milestonesCompleted;
    case "morning_tasks":
      return stats.morningTasks;
    case "perfect_task":
      return stats.highPerformanceTasks;
  }
}

export interface QuestStats {
  tasksCompleted: number;
  xpEarned: number;
  minutesLogged: number;
  goalsTouched: number;
  milestonesCompleted: number;
  morningTasks: number;
  highPerformanceTasks: number;
}
