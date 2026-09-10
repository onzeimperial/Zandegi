import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { compareWithFriend } from "@/server/social/service";

type Ctx = { params: Promise<{ id: string }> };

// :id here is the friend's USER id
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return ok(await compareWithFriend(user.id, id));
});
