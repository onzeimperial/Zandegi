import { z } from "zod";
import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { getDailyQuests, claimQuest, getDailyGoalProgress } from "@/server/engagement/service";
import { getStreakState } from "@/server/engagement/streak";

export const GET = route(async () => {
  const user = await requireUser();
  const [quests, dailyGoal, streak] = await Promise.all([
    getDailyQuests(user.id),
    getDailyGoalProgress(user.id),
    getStreakState(user.id),
  ]);
  return ok({ quests, dailyGoal, streak });
});

const claimSchema = z.object({ key: z.string().min(1).max(60) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { key } = await parseBody(req, claimSchema);
  const reward = await claimQuest(user.id, key);
  return ok({ reward, quests: await getDailyQuests(user.id) });
});
