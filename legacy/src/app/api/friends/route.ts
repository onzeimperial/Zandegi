import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { parseBody } from "@/lib/validation";
import { listFriends, sendFriendRequest } from "@/server/social/service";

export const GET = route(async () => {
  const user = await requireUser();
  return ok(await listFriends(user.id));
});

const addSchema = z.object({ email: z.string().email() });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { email } = await parseBody(req, addSchema);
  const fr = await sendFriendRequest(user.id, email);
  return ok({ friendship: { id: fr.id, status: fr.status } }, { status: 201 });
});
