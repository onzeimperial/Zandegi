"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/client";
import { Spinner, EmptyState, Progress, Badge, SectionHeading } from "@/components/ui/primitives";
import { Target, Plus } from "lucide-react";

interface GoalListItem {
  id: string;
  title: string;
  category: string;
  status: string;
  difficulty: number;
  level: number;
  progressPct: number;
  decompositionStatus: string;
  confidence: number;
  targetDate: string | null;
  counts: { tasks: number; milestones: number; skills: number; milestonesDone: number };
}

export default function GoalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<{ goals: GoalListItem[] }>("/api/goals"),
  });

  if (isLoading) return <Spinner className="py-24" />;
  const goals = data?.goals ?? [];
  const active = goals.filter((g) => g.status === "active");
  const others = goals.filter((g) => g.status !== "active");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="mt-1 text-sm text-muted">{active.length} active · {goals.length} total</p>
        </div>
        <Link href="/goals/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New goal
        </Link>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No goals yet"
          description="Anything from 'pass the UCAT' to 'get my life together' — Zandegi turns it into a plan."
          action={<Link href="/goals/new" className="btn-primary">Create your first goal</Link>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((g) => (
              <GoalCard key={g.id} g={g} />
            ))}
          </div>

          {others.length > 0 && (
            <div>
              <SectionHeading title="Paused, completed & archived" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((g) => (
                  <GoalCard key={g.id} g={g} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalCard({ g }: { g: GoalListItem }) {
  return (
    <Link href={`/goals/${g.id}`} className="card flex flex-col p-4 transition hover:border-brand/50">
      <div className="flex items-center justify-between">
        <Badge tone="brand">{g.category}</Badge>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span>Lv {g.level}</span>
          <span>·</span>
          <span>Difficulty {g.difficulty}/5</span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 flex-1 text-sm font-medium">{g.title}</p>
      <Progress value={g.progressPct} className="mt-3" />
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>{g.progressPct}% · {g.counts.milestonesDone}/{g.counts.milestones} milestones</span>
        <span>{g.counts.tasks} tasks</span>
      </div>
      {g.status !== "active" && <p className="mt-2 text-[11px] uppercase tracking-wide text-muted">{g.status}</p>}
      {g.decompositionStatus !== "ready" && g.status === "active" && (
        <p className="mt-2 text-[11px] text-warning">Plan {g.decompositionStatus}</p>
      )}
    </Link>
  );
}
