"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, Badge } from "@/components/ui/primitives";
import { ExternalLink, History } from "lucide-react";

interface Detail {
  current: {
    slug: string;
    domain: string;
    title: string;
    body: string;
    version: number;
    effectiveFrom: string;
    confidence: number;
    source: string | null;
    sourceUrl: string | null;
  };
  history: { version: number; effectiveFrom: string; confidence: number; isCurrent: boolean; source: string | null }[];
}

export default function KnowledgeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge", slug],
    queryFn: () => api.get<Detail>(`/api/knowledge/${slug}`),
  });

  if (isLoading) return <Spinner className="py-24" />;
  if (isError || !data) return <EmptyState title="Not found" action={<Link href="/knowledge" className="btn-outline">Back</Link>} />;

  const c = data.current;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/knowledge" className="text-xs text-muted hover:text-fg">← Knowledge base</Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{c.domain}</Badge>
          <Badge tone={c.confidence >= 75 ? "success" : c.confidence >= 50 ? "warning" : "danger"}>{c.confidence}% confidence</Badge>
          <span className="text-[11px] text-muted">v{c.version} · effective {new Date(c.effectiveFrom).toLocaleDateString()}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{c.title}</h1>
      </div>

      <article className="card whitespace-pre-wrap p-5 text-sm leading-relaxed text-fg/90">{c.body}</article>

      {c.confidence < 75 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          This entry is marked lower-confidence. Verify against the primary source before relying on specifics — real-world
          details (exam formats, scoring, requirements) change between cycles.
        </div>
      )}

      {c.source && (
        <p className="text-xs text-muted">
          Source: {c.source}
          {c.sourceUrl && (
            <>
              {" "}
              <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                open <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </p>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
          <History className="h-3.5 w-3.5" /> Version history
        </p>
        <div className="space-y-1.5">
          {data.history.map((h) => (
            <div key={h.version} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs">
              <span>v{h.version} {h.isCurrent && <Badge tone="success">current</Badge>}</span>
              <span className="text-muted">
                {new Date(h.effectiveFrom).toLocaleDateString()} · {h.confidence}% confidence
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
