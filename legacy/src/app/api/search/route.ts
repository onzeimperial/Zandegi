import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { globalSearch } from "@/server/search/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok({ results: await globalSearch(user.id, q) });
});
