import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getLeague } from "@/server/engagement/league-service";

export const GET = route(async () => {
  const user = await requireUser();
  return ok(await getLeague(user.id));
});
