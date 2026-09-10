"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/client";
import type { DashboardData } from "@/server/dashboard/service";
import { Spinner, Stat, SectionHeading, EmptyState, Progress, Badge } from "@/components/ui/primitives";
import { TaskRow } from "@/components/tasks/task-row";
import { RecommendationCard } from "@/components/coach/recommendation-card";
import { TrajectoryChart } from "@/components/analytics/trajectory-chart";
import { DailyPanel } from "@/components/engagement/daily-panel";
import { TrialBanner } from "@/components/billing/trial-banner";
import { Target, Flame, Zap, CheckCircle2, Trophy, ArrowRight, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard"),
  });

  if (isLoading) return <Spinner className="py-24" />;
  if (isError || !data)
    return <EmptyState title="Couldn't load your dashboard" description="Refresh the page or try again in a moment." />;

  const { profile, level, streak, today, goals, nextMilestone, recentAchievements, recommendations, week, trajectory } = data;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <TrialBanner />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {profile.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {today.total > 0
              ? `${today.completed}/${today.total} tasks done today · ${today.total - today.completed} to go`
              : "No tasks queued for today — pick a goal to generate this week's plan."}
          </p>
        </div>
        <Link href="/goals/new" className="btn-primary">
          <Target className="h-4 w-4" /> New goal
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Level" value={level.level} hint={`${level.xpToNextLevel} XP to level ${level.level + 1}`} />
        <Stat label="Streak" value={<span className="inline-flex items-center gap-1.5"><Flame className="h-5 w-5 text-warning" />{streak.current}</span>} hint={`Longest ${streak.longest}`} />
        <Stat label="XP this week" value={week.xpEarned} hint={`${week.tasksCompleted} tasks completed`} />
        <Stat label="Active goals" value={goals.length} hint={goals.length ? `${goals.reduce((a, g) => a + g.openTasks, 0)} open tasks` : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:hidden">
          <DailyPanel />
        </div>

        <section className="lg:col-span-2">
          <SectionHeading
            title="Today"
            subtitle="Highest-leverage first"
            action={<Link href="/coach" className="text-xs font-medium text-brand hover:underline">Ask the coach →</Link>}
          />
          {today.queue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Nothing queued"
              description="Open a goal and generate tasks, or add one yourself."
              action={<Link href="/goals" className="btn-outline">Go to goals</Link>}
            />
          ) : (
            <div className="space-y-2">
              {today.queue.map((t) => (
                <TaskRow
                  key={t.id}
                  task={{
                    id: t.id,
                    title: t.title,
                    goalTitle: t.goalTitle,
                    skill: t.skill,
                    priority: t.priority,
                    type: t.type,
                    estimatedMinutes: t.estimatedMinutes,
                    xpReward: t.xpReward,
                    status: t.status,
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="hidden lg:block">
            <DailyPanel />
          </div>

          <div>
            <SectionHeading title="Coach picks" />
            {recommendations.length === 0 ? (
              <p className="text-xs text-muted">No recommendations right now. Keep going — the planner will flag things as they come up.</p>
            ) : (
              <div className="space-y-2">
                {recommendations.slice(0, 3).map((r) => (
                  <RecommendationCard key={r.id} rec={r} />
                ))}
              </div>
            )}
          </div>

          {nextMilestone && (
            <div className="card p-4">
              <p className="text-xs text-muted">Next milestone</p>
              <p className="mt-1 text-sm font-medium">{nextMilestone.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {nextMilestone.goalTitle}
                {nextMilestone.dueDate ? ` · due ${new Date(nextMilestone.dueDate).toLocaleDateString()}` : ""}
              </p>
              <Link href={`/goals/${nextMilestone.goalId}`} className="btn-outline mt-3 w-full">
                Open goal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          <div>
            <SectionHeading title="Recent achievements" />
            {recentAchievements.length === 0 ? (
              <p className="text-xs text-muted">Complete tasks to start unlocking achievements.</p>
            ) : (
              <div className="space-y-1.5">
                {recentAchievements.map((a) => (
                  <div key={a.key} className="flex items-center gap-2 rounded-md border border-border bg-surface p-2.5">
                    <Trophy className="h-4 w-4 text-warning" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{a.name}</p>
                      <p className="truncate text-[11px] text-muted">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <section>
        <SectionHeading title="Active goals" action={<Link href="/goals" className="text-xs font-medium text-brand hover:underline">All goals →</Link>} />
        {goals.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="No goals yet"
            description="Tell Zandegi what you want to achieve and it builds the whole progression system."
            action={<Link href="/goals/new" className="btn-primary">Create your first goal</Link>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((g) => (
              <Link key={g.id} href={`/goals/${g.id}`} className="card p-4 transition hover:border-brand/50">
                <div className="flex items-center justify-between">
                  <Badge tone="brand">{g.category}</Badge>
                  <span className="text-[11px] text-muted">Lv {g.level}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium">{g.title}</p>
                <Progress value={g.progressPct} className="mt-3" />
                <p className="mt-1 flex items-center justify-between text-[11px] text-muted">
                  <span>{g.progressPct}% complete</span>
                  <span>{g.openTasks} open</span>
                </p>
                {g.decompositionStatus !== "ready" && (
                  <p className="mt-2 text-[11px] text-warning">Plan: {g.decompositionStatus}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {trajectory.length > 1 && (
        <section>
          <SectionHeading title="Trajectory" subtitle="Total XP over time" />
          <div className="card p-4">
            <TrajectoryChart data={trajectory.map((p) => ({ date: p.date, value: p.xp }))} />
          </div>
        </section>
      )}
    </div>
  );
}
