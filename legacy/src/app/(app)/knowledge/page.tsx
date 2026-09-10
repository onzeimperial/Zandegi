"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, Badge } from "@/components/ui/primitives";
import { Input } from "@/components/ui/field";
import { BookOpen, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Entry {
  slug: string;
  domain: string;
  title: string;
  body: string;
  version: number;
  effectiveFrom: string;
  confidence: number;
  source: string | null;
  sourceUrl: string | null;
}

export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", q, domain],
    queryFn: () =>
      api.get<{ entries: Entry[]; domains?: string[] }>(
        `/api/knowledge?${new URLSearchParams({ ...(q ? { q } : {}), ...(domain ? { domain } : {}) })}`,
      ),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge base</h1>
        <p className="mt-1 text-sm text-muted">
          Versioned real-world facts the planner draws on (exam formats, learning science). Each entry carries an
          effective date, a confidence level and a source — so stale information can be updated, not silently trusted.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search knowledge…" className="max-w-xs" />
        {(data?.domains ?? []).map((d) => (
          <button
            key={d}
            onClick={() => setDomain(domain === d ? null : d)}
            className={cn(
              "rounded-full px-3 py-1 text-xs capitalize",
              domain === d ? "bg-brand text-white" : "border border-border text-muted hover:text-fg",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.entries.length ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No entries" description="Run the seed script to populate the knowledge base." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.entries.map((e) => (
            <Link key={e.slug} href={`/knowledge/${e.slug}`} className="card p-4 transition hover:border-brand/50">
              <div className="flex items-center justify-between">
                <Badge tone="brand">{e.domain}</Badge>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px]",
                    e.confidence >= 75 ? "text-success" : e.confidence >= 50 ? "text-warning" : "text-danger",
                  )}
                >
                  {e.confidence >= 75 ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                  {e.confidence}% confidence
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{e.title}</p>
              <p className="mt-1 line-clamp-3 text-[11px] text-muted">{e.body}</p>
              <p className="mt-2 text-[10px] text-muted">
                v{e.version} · effective {new Date(e.effectiveFrom).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
