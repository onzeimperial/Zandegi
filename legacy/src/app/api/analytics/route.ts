import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getAnalytics } from "@/server/analytics/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const days = Math.min(120, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));
  return ok(await getAnalytics(user.id, days));
});
