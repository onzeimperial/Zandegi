import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listActiveMissions, getMissionPath, consumeWhatChanged } from "@/server/path/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const requestedGoalId = url.searchParams.get("goalId");

  const { summaries, defaultGoalId } = await listActiveMissions(user.id, requestedGoalId);
  const goalId = requestedGoalId ?? defaultGoalId;

  const [path, whatChanged] = await Promise.all([
    goalId ? getMissionPath(user.id, goalId) : Promise.resolve(null),
    consumeWhatChanged(user.id),
  ]);

  return ok({
    missions: summaries.map((s) => ({ ...s, isSelected: s.goalId === goalId })),
    path,
    whatChanged,
  });
});
