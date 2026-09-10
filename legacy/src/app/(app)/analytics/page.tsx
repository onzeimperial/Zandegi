"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import type { AnalyticsData } from "@/server/analytics/service";
import { Spinner, EmptyState, Stat, SectionHeading, Progress, Badge } from "@/components/ui/primitives";
import { BarsChart } from "@/components/analytics/bars-chart";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => api.get<AnalyticsData>(`/api/analytics?days=${days}`),
  });

  if (isLoading) return <Spinner className="py-24" />;
  if (!data) return <EmptyState title="No analytics yet" description="Complete a few tasks and check back." />;

  const { totals, daily, xpBySource, goalVelocity, weakestSkills, strongestSkills } = data;
  const hasActivity = totals.tasksCompleted > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted">Last {days} days</p>
        </div>
        <div className="flex rounded-md border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={cn("rounded px-3 py-1 text-xs", days === r.days ? "bg-brand text-white" : "text-muted hover:text-fg")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!hasActivity ? (
        <EmptyState title="Not enough data yet" description="Complete some tasks to see consistency, velocity and skill trends." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tasks completed" value={totals.tasksCompleted} hint={`${totals.tasksOutstanding} outstanding`} />
            <Stat label="Consistency" value={`${totals.consistencyPct}%`} hint={`${totals.activeDays}/${days} active days`} />
            <Stat label="Focus time" value={`${Math.round(totals.minutes / 60)}h`} hint={`${totals.minutes} min logged`} />
            <Stat label="Avg performance" value={totals.avgPerformance != null ? `${totals.avgPerformance}%` : "—"} hint={`streak ${totals.streakCurrent} (best ${totals.streakLongest})`} />
          </div>

          <section>
            <SectionHeading title="Daily activity" subtitle="Tasks completed per day" />
            <div className="card p-4">
              <BarsChart data={daily.map((d) => ({ date: d.date.slice(5), tasks: d.tasks }))} dataKey="tasks" label="tasks" />
            </div>
          </section>

          <section>
            <SectionHeading title="XP earned per day" />
            <div className="card p-4">
              <BarsChart data={daily.map((d) => ({ date: d.date.slice(5), xp: d.xp }))} dataKey="xp" label="XP" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <SectionHeading title="Goal velocity" subtitle="Progress % gained per week" />
              <div className="space-y-2">
                {goalVelocity.length === 0 && <p className="text-sm text-muted">No active goals.</p>}
                {goalVelocity.map((g) => (
                  <div key={g.id} className="card p-3">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium">{g.title}</p>
                      <Badge tone="brand">{g.perWeek}%/wk</Badge>
                    </div>
                    <Progress value={g.progressPct} className="mt-2" />
                    <p className="mt-1 text-[11px] text-muted">{g.progressPct}% · difficulty {g.difficulty}/5</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionHeading title="XP by source" />
              <div className="card space-y-2 p-4">
                {Object.entries(xpBySource).length === 0 && <p className="text-sm text-muted">No XP yet.</p>}
                {Object.entries(xpBySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, amount]) => {
                    const max = Math.max(...Object.values(xpBySource));
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-xs">
                          <span className="capitalize">{source.replace("_", " ")}</span>
                          <span className="text-muted">{amount}</span>
                        </div>
                        <Progress value={(amount / max) * 100} className="mt-1" />
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <SectionHeading title="Weakest skills" subtitle="Where to spend your next sessions" />
              <div className="space-y-2">
                {weakestSkills.map((s) => (
                  <SkillRow key={`${s.goal}-${s.name}`} s={s} tone="warning" />
                ))}
              </div>
            </section>
            <section>
              <SectionHeading title="Strongest skills" />
              <div className="space-y-2">
                {strongestSkills.map((s) => (
                  <SkillRow key={`${s.goal}-${s.name}`} s={s} tone="success" />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SkillRow({ s, tone }: { s: { name: string; goal: string; mastery: number }; tone: "warning" | "success" }) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{s.name}</p>
          <p className="truncate text-[11px] text-muted">{s.goal}</p>
        </div>
        <span className="text-xs text-muted">{s.mastery}%</span>
      </div>
      <Progress value={s.mastery} tone={tone === "success" ? "success" : "warning"} className="mt-2" />
    </div>
  );
}
