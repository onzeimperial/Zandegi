import { route, ok, assertSameOrigin, forbidden } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ status: z.enum(["seen", "accepted", "dismissed"]) });

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  const body = await parseBody(req, schema);

  const rec = await db.aiRecommendation.findUnique({ where: { id } });
  if (!rec || rec.userId !== user.id) throw forbidden();

  const updated = await db.aiRecommendation.update({ where: { id }, data: { status: body.status } });
  return ok({ recommendation: { id: updated.id, status: updated.status } });
});
