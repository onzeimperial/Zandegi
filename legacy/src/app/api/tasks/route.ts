import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, createTaskSchema } from "@/lib/validation";
import { getTodayQueue } from "@/server/tasks/service";
import { getOwnedGoal } from "@/server/goals/service";
import { db } from "@/lib/db";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const goalId = url.searchParams.get("goalId");

  if (goalId) {
    await getOwnedGoal(user.id, goalId);
    const tasks = await db.task.findMany({
      where: { goalId },
      orderBy: [{ status: "asc" }, { orderIndex: "asc" }],
      include: { skill: { select: { name: true } }, milestone: { select: { title: true } } },
    });
    return ok({ tasks });
  }

  const queue = await getTodayQueue(user.id);
  return ok({ tasks: queue });
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await parseBody(req, createTaskSchema);
  await getOwnedGoal(user.id, body.goalId);

  const last = await db.task.findFirst({ where: { goalId: body.goalId }, orderBy: { orderIndex: "desc" }, select: { orderIndex: true } });

  const task = await db.task.create({
    data: {
      goalId: body.goalId,
      title: body.title,
      description: body.description ?? null,
      type: body.type ?? "once",
      skillId: body.skillId ?? null,
      milestoneId: body.milestoneId ?? null,
      difficulty: body.difficulty ?? 2,
      estimatedMinutes: body.estimatedMinutes ?? 30,
      priority: body.priority ?? "medium",
      dueDate: body.dueDate ?? null,
      scheduledFor: body.scheduledFor ?? new Date(),
      recurrenceRule: body.recurrenceRule ?? null,
      orderIndex: (last?.orderIndex ?? 0) + 1,
      xpReward: 20 + (body.difficulty ?? 2) * 15,
      aiGenerated: false,
    },
  });

  return ok({ task }, { status: 201 });
});
