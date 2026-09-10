import { db } from "@/lib/db";
import { notFound, forbidden } from "@/lib/errors";
import { domainForCategory, DOMAIN_COLORS, type Domain } from "@/server/domains";
import { levelFromXp } from "@/server/xp/levels";
import type { GoalCategory } from "@/lib/constants";
import type { MissionSummary, MissionPath, PathChapter, PathNode, ChangeEvent } from "./types";

const FALLBACK_COLOR = "rgb(var(--g-text-dim))";

function colorFor(category: GoalCategory): { domain: Domain | null; color: string } {
  const domain = domainForCategory(category);
  return { domain, color: domain ? DOMAIN_COLORS[domain] : FALLBACK_COLOR };
}

/** Every active goal, for the mission switcher. Real rows, no placeholders. */
export async function listActiveMissions(userId: string, selectedGoalId: string | null) {
  const goals = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { lastActivityAt: "desc" },
  });

  const summaries: MissionSummary[] = goals.map((g) => {
    const { domain, color } = colorFor(g.category as GoalCategory);
    return {
      goalId: g.id,
      title: g.title,
      domain,
      color,
      progressPct: g.progressPct,
      level: g.level,
      isSelected: g.id === selectedGoalId,
    };
  });

  return { summaries, defaultGoalId: goals[0]?.id ?? null };
}

/**
 * The full chapter/step track for one mission (Goal -> Milestone -> Task).
 * Node states come straight from real Milestone.status / Task.status:
 *
 *   - a task is "done" iff Task.status === "done"
 *   - exactly one task is "active": the first incomplete task, in order,
 *     inside the first non-done milestone
 *   - other incomplete tasks in that same (active) milestone are "available"
 *     — the data model doesn't order them strictly against each other
 *   - every task in a milestone that is still "locked" is "locked"
 */
export async function getMissionPath(userId: string, goalId: string): Promise<MissionPath> {
  const goal = await db.goal.findUnique({
    where: { id: goalId },
    include: {
      milestones: {
        orderBy: { orderIndex: "asc" },
        include: { tasks: { orderBy: { orderIndex: "asc" } } },
      },
    },
  });
  if (!goal) throw notFound("Mission");
  if (goal.userId !== userId) throw forbidden();

  const { domain, color } = colorFor(goal.category as GoalCategory);

  let activeAssigned = false;
  let activeNodeId: string | null = null;

  const chapters: PathChapter[] = goal.milestones.map((m) => {
    const nodes: PathNode[] = m.tasks
      .filter((t) => t.status !== "skipped")
      .map((t) => {
        let state: PathNode["state"];
        if (t.status === "done") {
          state = "done";
        } else if (m.status === "locked") {
          state = "locked";
        } else if (!activeAssigned) {
          state = "active";
          activeAssigned = true;
          activeNodeId = t.id;
        } else {
          state = "available";
        }
        return { id: t.id, title: t.title, xpReward: t.xpReward, state };
      });

    return {
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status as PathChapter["status"],
      targetLevel: m.targetLevel,
      xpReward: m.xpReward,
      tasksDone: nodes.filter((n) => n.state === "done").length,
      tasksTotal: nodes.length,
      nodes,
    };
  });

  return {
    goalId: goal.id,
    title: goal.title,
    domain,
    color,
    progressPct: goal.progressPct,
    level: goal.level,
    targetLevel: goal.targetLevel,
    chapters,
    activeNodeId,
  };
}

/**
 * What changed since the user's last Path view — real diffs only, checked
 * in order of significance. A brand-new account (lastSeenAt is null) gets
 * nothing, rather than being shown its entire history as "new".
 *
 * This both reads the diff and advances lastSeenAt to now, so a second call
 * immediately after returns nothing — matches "since you were last here".
 */
export async function consumeWhatChanged(userId: string): Promise<ChangeEvent | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) throw notFound("Profile");

  const since = profile.lastSeenAt;
  await db.profile.update({ where: { userId }, data: { lastSeenAt: new Date() } });

  if (!since) return null;

  const milestone = await db.milestone.findFirst({
    where: { goal: { userId }, status: "done", completedAt: { gt: since } },
    orderBy: { completedAt: "desc" },
    include: { goal: { select: { title: true } } },
  });
  if (milestone) {
    return {
      kind: "milestone_completed",
      title: milestone.title,
      goalTitle: milestone.goal.title,
      xpReward: milestone.xpReward,
    };
  }

  // Reconstruct XP as of the last visit from the XpEvent ledger, since we
  // don't store historical level readings — every XP change writes an
  // XpEvent, so summing up to a point in time is exact, not estimated.
  const historicalAgg = await db.xpEvent.aggregate({
    where: { userId, createdAt: { lte: since } },
    _sum: { amount: true },
  });
  const historicalLevel = levelFromXp(Math.max(0, historicalAgg._sum.amount ?? 0));
  if (profile.level > historicalLevel) {
    return { kind: "level_up", level: profile.level };
  }

  const streak = await db.streak.findUnique({ where: { userId } });
  if (streak?.lastActiveDate && streak.lastActiveDate > since && streak.current > 0) {
    return { kind: "streak_advanced", current: streak.current };
  }

  return null;
}
