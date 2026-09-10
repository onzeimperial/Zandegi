import { z } from "zod";
import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { getEntitlements, startTrial, cancelSubscription } from "@/server/billing/service";
import { PLAN_FEATURES } from "@/server/billing/plans";
import { TRIAL_DAYS } from "@/lib/constants";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({
    entitlements: await getEntitlements(user.id),
    features: PLAN_FEATURES,
    trialDays: TRIAL_DAYS,
  });
});

const postSchema = z.object({ action: z.enum(["start_trial", "cancel"]) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { action } = await parseBody(req, postSchema);

  if (action === "start_trial") await startTrial(user.id);
  else await cancelSubscription(user.id);

  return ok({ entitlements: await getEntitlements(user.id) });
});
