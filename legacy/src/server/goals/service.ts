import { db } from "@/lib/db";
import { HttpError, notFound, forbidden } from "@/lib/errors";
import { addWeeks } from "date-fns";
import type { GoalPlan } from "@/ai/schemas";
import { decomposeGoal } from "@/ai/decompose";
import { evaluateAchievements } from "@/server/achievements/evaluate";
import { recomputeGoalPlan } from "@/server/planning/adaptive";
import { getTemplate } from "@/server/catalog/service";
import { templateToPlan } from "@/server/catalog/expand";

export interface CreateGoalInput {
  userId: string;
  rawInput: string;
  title?: string;
  targetDate?: Date | null;
  visibility?: "private" | "friends" | "public";
  /** Skip AI, use rules-based planner. */
  preferHeuristic?: boolean;
  clarificationAnswers?: string | null;
  /** Start from a catalogue entry instead of decomposing free text. */
  templateKey?: string | null;
}

/**
 * Create a goal row immediately (status active, decomposition pending), then
 * run decomposition and apply the plan. Returns the goal id and whether the
 * AI asked for clarification.
 */
export async function createGoalWithPlan(input: CreateGoalInput) {
  const profile = await db.profile.findUnique({ where: { userId: input.userId } });
  const dailyMinutes = profile?.dailyMinutes ?? 45;
  const weeklyDays = profile?.weeklyDays ?? 5;

  const template = input.templateKey ? getTemplate(input.templateKey) : null;

  const goal = await db.goal.create({
    data: {
      userId: input.userId,
      title: template?.title || input.title?.trim() || input.rawInput.trim().slice(0, 110),
      rawInput: input.rawInput.trim(),
      targetDate: input.targetDate ?? null,
      visibility: input.visibility ?? "private",
      templateKey: template?.key ?? null,
      decompositionStatus: "generating",
    },
  });

  // A catalogue entry already carries hand-written skills and milestones for
  // this specific goal, so it skips decomposition entirely.
  if (template) {
    const weeksFromTarget = input.targetDate
      ? Math.max(1, Math.round((input.targetDate.getTime() - Date.now()) / (7 * 864e5)))
      : null;

    const plan = templateToPlan(template, {
      dailyMinutes,
      weeklyDays,
      timelineWeeks: weeksFromTarget,
    });

    await applyPlanToGoal(goal.id, plan, {
      provider: "catalog",
      model: `template:${template.key}`,
      dailyMinutes,
      weeklyDays,
    });
    await evaluateAchievements(input.userId, { goalId: goal.id });

    return {
      goalId: goal.id,
      needsClarification: false as const,
      provider: "catalog" as const,
      model: `template:${template.key}`,
    };
  }

  try {
    const out = await decomposeGoal({
      rawInput: input.rawInput,
      dailyMinutes,
      weeklyDays,
      targetDate: input.targetDate ?? null,
      preferHeuristic: input.preferHeuristic,
      clarificationAnswers: input.clarificationAnswers ?? null,
    });

    if ("needsClarification" in out.result && out.result.needsClarification === true) {
      await db.goal.update({
        where: { id: goal.id },
        data: { decompositionStatus: "pending", summary: out.result.interpretationSoFar },
      });
      return {
        goalId: goal.id,
        needsClarification: true as const,
        questions: out.result.questions,
        interpretation: out.result.interpretationSoFar,
        provider: out.provider,
      };
    }

    await applyPlanToGoal(goal.id, out.result as GoalPlan, {
      provider: out.provider,
      model: out.model,
      dailyMinutes,
      weeklyDays,
    });

    await evaluateAchievements(input.userId, { goalId: goal.id });

    return {
      goalId: goal.id,
      needsClarification: false as const,
      provider: out.provider,
      fallbackReason: out.fallbackReason ?? null,
    };
  } catch (err) {
    await db.goal.update({ where: { id: goal.id }, data: { decompositionStatus: "failed" } });
    throw err instanceof HttpError
      ? err
      : new HttpError(502, "decomposition_failed", "Could not build a plan for this goal. Try rephrasing or use the manual planner.");
  }
}

/** Persist a validated plan: milestones, skill tree, prerequisites, tasks, resources. */
export async function applyPlanToGoal(
  goalId: string,
  plan: GoalPlan,
  meta: {
    provider: "ai" | "heuristic" | "catalog";
    model: string | null;
    dailyMinutes: number;
    weeklyDays: number;
  },
) {
  await db.$transaction(async (tx) => {
    // wipe any previous generated structure (keeps completions/xp history intact via SetNull)
    await tx.task.deleteMany({ where: { goalId, aiGenerated: true, status: "todo" } });
    await tx.skillPrerequisite.deleteMany({ where: { skill: { goalId } } });
    await tx.skill.deleteMany({ where: { goalId } });
    await tx.milestone.deleteMany({ where: { goalId } });

    await tx.goal.update({
      where: { id: goalId },
      data: {
        title: plan.title,
        summary: plan.summary,
        category: plan.category,
        difficulty: plan.difficulty,
        confidence: plan.confidence,
        startLevel: plan.startLevel,
        targetLevel: plan.targetLevel,
        currentLevel: plan.startLevel,
        timelineWeeks: plan.recommendedTimelineWeeks,
        decompositionStatus: "ready",
        aiModel: meta.model,
        planVersion: { increment: 1 },
        metricName: plan.metric?.name ?? null,
        metricStart: plan.metric?.start ?? null,
        metricTarget: plan.metric?.target ?? null,
        metricCurrent: plan.metric?.start ?? null,
        lastActivityAt: new Date(),
      },
    });

    // Milestones
    const milestoneIdByTitle = new Map<string, string>();
    for (let i = 0; i < plan.milestones.length; i++) {
      const m = plan.milestones[i]!;
      const row = await tx.milestone.create({
        data: {
          goalId,
          title: m.title,
          description: m.description,
          orderIndex: i,
          targetLevel: m.targetLevel,
          status: i === 0 ? "active" : "locked",
          dueDate: m.etaWeeks ? addWeeks(new Date(), m.etaWeeks) : null,
          xpReward: 150 + i * 75,
        },
      });
      milestoneIdByTitle.set(m.title, row.id);
    }

    // Skills — two passes for parent links
    const skillIdByName = new Map<string, string>();
    for (let i = 0; i < plan.skills.length; i++) {
      const s = plan.skills[i]!;
      const row = await tx.skill.create({
        data: {
          goalId,
          name: s.name,
          description: s.description,
          category: s.category || plan.category,
          orderIndex: i,
          confidence: s.startingConfidence,
          mastery: Math.round(s.startingConfidence * 0.3),
        },
      });
      skillIdByName.set(s.name, row.id);
    }
    for (const s of plan.skills) {
      const id = skillIdByName.get(s.name)!;
      if (s.parent && skillIdByName.has(s.parent)) {
        await tx.skill.update({ where: { id }, data: { parentId: skillIdByName.get(s.parent)! } });
      }
      for (const p of s.prerequisites ?? []) {
        const pid = skillIdByName.get(p);
        if (pid && pid !== id) {
          await tx.skillPrerequisite.create({ data: { skillId: id, prerequisiteId: pid } }).catch(() => {});
        }
      }
    }

    // Tasks
    for (let i = 0; i < plan.tasks.length; i++) {
      const t = plan.tasks[i]!;
      await tx.task.create({
        data: {
          goalId,
          skillId: t.skill ? skillIdByName.get(t.skill) ?? null : null,
          milestoneId: t.milestone ? milestoneIdByTitle.get(t.milestone) ?? null : null,
          title: t.title,
          description: t.description,
          type: t.type,
          difficulty: t.difficulty,
          estimatedMinutes: t.estimatedMinutes,
          priority: t.priority,
          orderIndex: i,
          recurrenceRule: t.recurrence ?? null,
          xpReward: 20 + t.difficulty * 15,
          aiGenerated: true,
          scheduledFor: t.type === "daily" || t.type === "once" ? new Date() : null,
        },
      });
    }

    // Resources
    for (const r of plan.resources ?? []) {
      await tx.resource.create({
        data: {
          goalId,
          skillId: r.skill ? skillIdByName.get(r.skill) ?? null : null,
          title: r.title,
          url: r.url ?? null,
          type: r.type,
          notes: r.note,
          addedBy: meta.provider === "ai" ? "ai" : "user",
        },
      });
    }

    // Store uncertain facts as a "verify these" recommendation
    if (plan.uncertainFacts?.length) {
      const owner = await tx.goal.findUniqueOrThrow({ where: { id: goalId }, select: { userId: true } });
      await tx.aiRecommendation.create({
        data: {
          userId: owner.userId,
          goalId,
          kind: "plan_change",
          title: "Verify these facts",
          body: `This plan contains claims that may be out of date:\n- ${plan.uncertainFacts.join("\n- ")}`,
          rationale: "Flagged by the planner as potentially stale real-world information.",
          priority: 3,
        },
      });
    }
  }, { timeout: 20_000 });

  await recomputeGoalPlan(goalId).catch(() => {});
}

export async function getOwnedGoal(userId: string, goalId: string) {
  const goal = await db.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw notFound("Goal");
  if (goal.userId !== userId) throw forbidden();
  return goal;
}

export async function getGoalWorkspace(userId: string, goalId: string) {
  await getOwnedGoal(userId, goalId);
  return db.goal.findUnique({
    where: { id: goalId },
    include: {
      milestones: { orderBy: { orderIndex: "asc" } },
      skills: { orderBy: { orderIndex: "asc" }, include: { prerequisites: { include: { prerequisite: true } } } },
      tasks: { orderBy: [{ status: "asc" }, { orderIndex: "asc" }] },
      resources: true,
      aiRecommendations: { where: { status: { in: ["new", "seen"] } }, orderBy: { priority: "asc" } },
      progressSnapshots: { orderBy: { date: "desc" }, take: 30 },
    },
  });
}

export async function listGoals(userId: string) {
  return db.goal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { lastActivityAt: "desc" }],
    include: {
      _count: { select: { tasks: true, milestones: true, skills: true } },
      milestones: { where: { status: "done" }, select: { id: true } },
    },
  });
}
