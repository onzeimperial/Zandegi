import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return ok({ notifications: items, unread });
});

const markSchema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await parseBody(req, markSchema);
  await db.notification.updateMany({
    where: { userId: user.id, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { read: true },
  });
  return ok({ ok: true });
});
