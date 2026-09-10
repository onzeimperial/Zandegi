import { route, ok, assertSameOrigin, forbidden } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, coachActionSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { getOwnedGoal } from "@/server/goals/service";
import { recomputeGoalPlan } from "@/server/planning/adaptive";
import { addDays } from "date-fns";
import { clamp } from "@/lib/utils";

/**
 * Apply a coach-proposed action. The AI never mutates data directly — the user
 * explicitly confirms each proposed action, and every action is re-validated
 * and ownership-checked here.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { action } = await parseBody(req, coachActionSchema);

  await getOwnedGoal(user.id, action.goalId);

  if (action.type === "create_task") {
    const skill = action.skillName
      ? await db.skill.findFirst({ where: { goalId: action.goalId, name: { equals: action.skillName } } })
      : null;
    const last = await db.task.findFirst({ where: { goalId: action.goalId }, orderBy: { orderIndex: "desc" }, select: { orderIndex: true } });
    const task = await db.task.create({
      data: {
        goalId: action.goalId,
        skillId: skill?.id ?? null,
        title: action.title,
        description: action.description ?? "",
        difficulty: action.difficulty ?? 2,
        estimatedMinutes: action.estimatedMinutes ?? 30,
        priority: action.priority ?? "medium",
        dueDate: action.dueInDays != null ? addDays(new Date(), action.dueInDays) : null,
        scheduledFor: new Date(),
        orderIndex: (last?.orderIndex ?? 0) + 1,
        xpReward: 20 + (action.difficulty ?? 2) * 15,
        aiGenerated: true,
      },
    });
    return ok({ applied: "create_task", task });
  }

  if (action.type === "adjust_timeline") {
    const goal = await db.goal.update({
      where: { id: action.goalId },
      data: { timelineWeeks: action.newTimelineWeeks, planVersion: { increment: 1 } },
    });
    await recomputeGoalPlan(action.goalId).catch(() => {});
    return ok({ applied: "adjust_timeline", timelineWeeks: goal.timelineWeeks });
  }

  if (action.type === "reprioritise_skill") {
    const skill = await db.skill.findFirst({ where: { goalId: action.goalId, name: action.skillName } });
    if (!skill) throw forbidden("Skill not found on this goal");
    const updated = await db.skill.update({
      where: { id: skill.id },
      data: { confidence: clamp(action.newConfidence, 0, 100) },
    });
    return ok({ applied: "reprioritise_skill", skill: { id: updated.id, confidence: updated.confidence } });
  }

  throw forbidden("Unknown action");
});
