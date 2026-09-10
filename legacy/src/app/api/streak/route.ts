import { z } from "zod";
import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { getStreakState, buyStreakFreeze, repairStreak } from "@/server/engagement/streak";

export const GET = route(async () => {
  const user = await requireUser();
  return ok(await getStreakState(user.id));
});

const postSchema = z.object({ action: z.enum(["buy_freeze", "repair"]) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { action } = await parseBody(req, postSchema);

  if (action === "buy_freeze") await buyStreakFreeze(user.id);
  else await repairStreak(user.id);

  return ok(await getStreakState(user.id));
});
