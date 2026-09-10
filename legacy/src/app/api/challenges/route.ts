import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { CHALLENGE_METRICS } from "@/lib/constants";
import { createChallenge, listChallenges } from "@/server/social/challenges";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ challenges: await listChallenges(user.id) });
});

const schema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  metric: z.enum(CHALLENGE_METRICS),
  target: z.coerce.number().int().min(1).max(1_000_000),
  endsAt: z.coerce.date(),
  visibility: z.enum(["friends", "private", "public"]).optional(),
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await parseBody(req, schema);
  const c = await createChallenge(user.id, body);
  return ok({ challenge: { id: c.id } }, { status: 201 });
});
