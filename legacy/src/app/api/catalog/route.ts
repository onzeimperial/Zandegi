import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { browseCatalog } from "@/server/catalog/service";

export const GET = route(async (req: Request) => {
  await requireUser();
  const url = new URL(req.url);
  const num = (k: string) => {
    const v = url.searchParams.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return ok(
    browseCatalog({
      q: url.searchParams.get("q") ?? undefined,
      domain: url.searchParams.get("domain") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      maxDifficulty: num("maxDifficulty"),
      limit: num("limit"),
      offset: num("offset"),
    }),
  );
});
