import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { retrieveKnowledge } from "@/ai/knowledge";

export const GET = route(async (req: Request) => {
  await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const domain = url.searchParams.get("domain") ?? undefined;

  if (q && q.trim().length >= 2) {
    const hits = await retrieveKnowledge({ text: q, domain, limit: 20 });
    return ok({ entries: hits });
  }

  const entries = await db.knowledgeEntry.findMany({
    where: { isCurrent: true, ...(domain ? { domain } : {}) },
    orderBy: [{ domain: "asc" }, { title: "asc" }],
    select: { slug: true, domain: true, title: true, body: true, version: true, effectiveFrom: true, confidence: true, source: true, sourceUrl: true },
  });
  const domains = [...new Set(entries.map((e) => e.domain))];
  return ok({ entries, domains });
});
