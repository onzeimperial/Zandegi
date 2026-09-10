"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Clock, Layers, ArrowRight } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner, EmptyState, Badge } from "@/components/ui/primitives";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { GOAL_CATEGORY_LABELS, type GoalCategory } from "@/lib/constants";

interface CatalogEntry {
  key: string;
  title: string;
  summary: string;
  category: GoalCategory;
  domain: string;
  difficulty: number;
  weeks: number;
  tags: string[];
  skillCount: number;
  milestoneCount: number;
}

interface DomainInfo {
  key: string;
  label: string;
  blurb: string;
  count: number;
}

interface CatalogResponse {
  total: number;
  items: CatalogEntry[];
  domains: DomainInfo[];
}

const DIFFICULTY_LABELS = ["", "Light", "Steady", "Serious", "Demanding", "Life-defining"];

export default function CatalogPage() {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["catalog", q, domain],
    queryFn: () =>
      api.get<CatalogResponse>(
        `/api/catalog?${new URLSearchParams({
          ...(q ? { q } : {}),
          ...(domain ? { domain } : {}),
          limit: "120",
        })}`,
      ),
  });

  async function start(entry: CatalogEntry) {
    setStarting(entry.key);
    try {
      const res = await api.post<{ goalId: string }>("/api/goals", {
        rawInput: entry.title,
        templateKey: entry.key,
      });
      toast.push({ kind: "success", title: `Started: ${entry.title}` });
      router.push(`/goals/${res.goalId}`);
    } catch (e) {
      toast.push({
        kind: "error",
        title: e instanceof ApiClientError ? e.message : "Couldn't start that goal",
      });
      setStarting(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Goal catalogue</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a goal and get a plan built for it — skills, milestones and a task backlog, ready to
          start. Or{" "}
          <button onClick={() => router.push("/goals/new")} className="text-brand hover:underline">
            describe your own
          </button>
          .
        </p>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search goals — running, Spanish, savings, guitar…"
          className="pl-9"
          aria-label="Search the goal catalogue"
        />
      </div>

      {data ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setDomain(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              domain === null
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            All ({data.domains.reduce((a, d) => a + d.count, 0)})
          </button>
          {data.domains.map((d) => (
            <button
              key={d.key}
              onClick={() => setDomain(d.key)}
              title={d.blurb}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                domain === d.key
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {d.label} ({d.count})
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <Spinner className="py-24" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No matching goals"
          description="Try a different search, or describe your own goal from scratch."
        />
      ) : (
        <>
          <p className="text-xs text-muted">
            {data.total} goal{data.total === 1 ? "" : "s"}
            {q ? ` matching "${q}"` : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.items.map((entry) => (
              <article key={entry.key} className="card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold">{entry.title}</h2>
                  <Badge>{GOAL_CATEGORY_LABELS[entry.category] ?? entry.category}</Badge>
                </div>
                <p className="mt-1.5 flex-1 text-xs text-muted">{entry.summary}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{entry.weeks} weeks
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {entry.skillCount} skills ·{" "}
                    {entry.milestoneCount} milestones
                  </span>
                  <span>{DIFFICULTY_LABELS[entry.difficulty]}</span>
                </div>

                <button
                  onClick={() => start(entry)}
                  disabled={starting !== null}
                  className="btn-primary mt-3 w-full"
                >
                  {starting === entry.key ? "Starting…" : "Start this goal"}
                  {starting === entry.key ? null : <ArrowRight className="h-4 w-4" />}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
