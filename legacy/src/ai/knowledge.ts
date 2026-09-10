import { db } from "@/lib/db";

/**
 * Versioned knowledge retrieval. Real-world facts that change over time
 * (exam formats, scoring, rankings) live in the KnowledgeEntry table, NOT
 * hardcoded in prompts. Only `isCurrent` rows are returned, with their
 * effective date and confidence so the model can hedge appropriately.
 */

export interface KnowledgeHit {
  slug: string;
  domain: string;
  title: string;
  body: string;
  version: number;
  effectiveFrom: Date;
  confidence: number;
  source: string | null;
  sourceUrl: string | null;
}

export async function retrieveKnowledge(query: {
  text: string;
  domain?: string;
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const terms = query.text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
    .slice(0, 12);

  const rows = await db.knowledgeEntry.findMany({
    where: {
      isCurrent: true,
      ...(query.domain ? { domain: query.domain } : {}),
    },
    orderBy: { effectiveFrom: "desc" },
    take: 200,
  });

  const scored = rows
    .map((r) => {
      const hay = `${r.slug} ${r.title} ${r.body} ${r.domain}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { r, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit ?? 4);

  return scored.map(({ r }) => ({
    slug: r.slug,
    domain: r.domain,
    title: r.title,
    body: r.body,
    version: r.version,
    effectiveFrom: r.effectiveFrom,
    confidence: r.confidence,
    source: r.source,
    sourceUrl: r.sourceUrl,
  }));
}

export function formatKnowledgeForPrompt(hits: KnowledgeHit[]): string | null {
  if (!hits.length) return null;
  return hits
    .map(
      (h) =>
        `### ${h.title}  (v${h.version}, effective ${h.effectiveFrom.toISOString().slice(0, 10)}, confidence ${h.confidence}%)\n${h.body}${
          h.sourceUrl ? `\nSource: ${h.sourceUrl}` : ""
        }`,
    )
    .join("\n\n");
}
