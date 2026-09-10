import { route, ok, assertSameOrigin, rateLimit, tooMany } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, decomposeSchema } from "@/lib/validation";
import { getOwnedGoal, applyPlanToGoal } from "@/server/goals/service";
import { decomposeGoal } from "@/ai/decompose";
import { db } from "@/lib/db";
import { evaluateAchievements } from "@/server/achievements/evaluate";
import type { GoalPlan } from "@/ai/schemas";
import { env } from "@/lib/env";

type Ctx = { params: Promise<{ id: string }> };

/** (Re)generate the plan for an existing goal, optionally with clarification answers. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  const goal = await getOwnedGoal(user.id, id);

  const rl = rateLimit(`decompose:${user.id}`, Math.max(4, Math.floor(env.ZANDEGI_AI_RATE_LIMIT / 2)), 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfter);

  const body = await parseBody(req, decomposeSchema);
  const profile = await db.profile.findUnique({ where: { userId: user.id } });

  if (body.rawInputOverride && body.rawInputOverride !== goal.rawInput) {
    await db.goal.update({ where: { id }, data: { rawInput: body.rawInputOverride } });
  }

  await db.goal.update({ where: { id }, data: { decompositionStatus: "generating" } });

  const out = await decomposeGoal({
    rawInput: body.rawInputOverride ?? goal.rawInput,
    dailyMinutes: profile?.dailyMinutes ?? 45,
    weeklyDays: profile?.weeklyDays ?? 5,
    targetDate: goal.targetDate,
    preferHeuristic: body.preferHeuristic,
    clarificationAnswers: body.clarificationAnswers ?? null,
  });

  if ("needsClarification" in out.result && out.result.needsClarification === true) {
    await db.goal.update({ where: { id }, data: { decompositionStatus: "pending", summary: out.result.interpretationSoFar } });
    return ok({
      needsClarification: true,
      questions: out.result.questions,
      interpretation: out.result.interpretationSoFar,
      provider: out.provider,
    });
  }

  await applyPlanToGoal(id, out.result as GoalPlan, {
    provider: out.provider,
    model: out.model,
    dailyMinutes: profile?.dailyMinutes ?? 45,
    weeklyDays: profile?.weeklyDays ?? 5,
  });
  await evaluateAchievements(user.id, { goalId: id });

  return ok({ needsClarification: false, provider: out.provider, model: out.model, fallbackReason: out.fallbackReason ?? null });
});
