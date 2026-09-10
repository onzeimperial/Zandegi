import { route, ok, assertSameOrigin, forbidden } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getChallenge } from "@/server/social/challenges";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return ok(await getChallenge(user.id, id));
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  const c = await db.challenge.findUnique({ where: { id }, select: { creatorId: true } });
  if (!c || c.creatorId !== user.id) throw forbidden("Only the creator can delete a challenge");
  await db.challenge.delete({ where: { id } });
  return ok({ deleted: true });
});
