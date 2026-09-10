import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/server/dashboard/service";
import { recomputeAllGoals } from "@/server/planning/adaptive";
import { captureSnapshot } from "@/server/progress/snapshot";

export const GET = route(async () => {
  const user = await requireUser();
  // Keep plans + today's snapshot fresh on dashboard load (best-effort, non-blocking failures).
  await Promise.allSettled([recomputeAllGoals(user.id), captureSnapshot(user.id, null)]);
  const data = await getDashboard(user.id);
  return ok(data);
});
