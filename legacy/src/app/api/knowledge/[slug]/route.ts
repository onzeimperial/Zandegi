import { route, ok, notFound } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const { slug } = await params;

  const versions = await db.knowledgeEntry.findMany({
    where: { slug },
    orderBy: { version: "desc" },
  });
  if (!versions.length) throw notFound("Knowledge entry");

  const current = versions.find((v) => v.isCurrent) ?? versions[0]!;
  return ok({
    current,
    history: versions.map((v) => ({
      version: v.version,
      effectiveFrom: v.effectiveFrom,
      confidence: v.confidence,
      isCurrent: v.isCurrent,
      source: v.source,
    })),
  });
});
