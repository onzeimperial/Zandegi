import { route, ok, assertSameOrigin, notFound } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, updateGoalSchema } from "@/lib/validation";
import { getGoalWorkspace, getOwnedGoal } from "@/server/goals/service";
import { db } from "@/lib/db";
import { recomputeGoalPlan } from "@/server/planning/adaptive";
import { parseJson } from "@/lib/json";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const goal = await getGoalWorkspace(user.id, id);
  if (!goal) throw notFound("Goal");
  return ok({
    goal: {
      ...goal,
      aiRecommendations: goal.aiRecommendations.map((r) => ({ ...r, meta: parseJson(r.meta, null) })),
    },
  });
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  await getOwnedGoal(user.id, id);
  const body = await parseBody(req, updateGoalSchema);

  const updated = await db.goal.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.status !== undefined ? { status: body.status, completedAt: body.status === "completed" ? new Date() : null } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.targetDate !== undefined ? { targetDate: body.targetDate } : {}),
      ...(body.metricCurrent !== undefined ? { metricCurrent: body.metricCurrent } : {}),
    },
  });

  await recomputeGoalPlan(id).catch(() => {});
  return ok({ goal: updated });
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  await getOwnedGoal(user.id, id);
  await db.goal.delete({ where: { id } });
  return ok({ deleted: true });
});
