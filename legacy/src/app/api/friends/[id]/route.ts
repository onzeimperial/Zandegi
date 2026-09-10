import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { respondToRequest } from "@/server/social/service";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ action: z.enum(["accept", "decline", "block"]) });

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  const { action } = await parseBody(req, schema);
  return ok(await respondToRequest(user.id, id, action));
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  return ok(await respondToRequest(user.id, id, "decline"));
});
