import { route, ok, assertSameOrigin, rateLimit, tooMany } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, createGoalSchema } from "@/lib/validation";
import { listGoals, createGoalWithPlan } from "@/server/goals/service";
import { seedAchievementsIfNeeded } from "@/server/achievements/seed-runtime";
import { assertCanCreateGoal } from "@/server/billing/service";
import { env } from "@/lib/env";

export const GET = route(async () => {
  const user = await requireUser();
  const goals = await listGoals(user.id);
  return ok({
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      status: g.status,
      difficulty: g.difficulty,
      level: g.level,
      progressPct: Math.round(g.progressPct),
      decompositionStatus: g.decompositionStatus,
      confidence: g.confidence,
      targetDate: g.targetDate,
      counts: { tasks: g._count.tasks, milestones: g._count.milestones, skills: g._count.skills, milestonesDone: g.milestones.length },
      updatedAt: g.updatedAt,
    })),
  });
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();

  const rl = rateLimit(`goal-create:${user.id}`, env.ZANDEGI_AI_RATE_LIMIT, 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfter);

  // Free accounts are capped on simultaneously active goals.
  await assertCanCreateGoal(user.id);

  await seedAchievementsIfNeeded();
  const body = await parseBody(req, createGoalSchema);

  const result = await createGoalWithPlan({
    userId: user.id,
    rawInput: body.rawInput,
    title: body.title,
    targetDate: body.targetDate ?? null,
    visibility: body.visibility,
    preferHeuristic: body.preferHeuristic,
    templateKey: body.templateKey ?? null,
  });

  return ok(result, { status: 201 });
});
