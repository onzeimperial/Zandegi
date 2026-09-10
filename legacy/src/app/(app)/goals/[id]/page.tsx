"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { Spinner, EmptyState, Progress, Badge, SectionHeading, Stat } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { TaskRow } from "@/components/tasks/task-row";
import { SkillTree } from "@/components/goals/skill-tree";
import { MilestoneTimeline } from "@/components/goals/milestone-timeline";
import { CoachChat } from "@/components/coach/coach-chat";
import { RecommendationCard } from "@/components/coach/recommendation-card";
import { TrajectoryChart } from "@/components/analytics/trajectory-chart";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { RefreshCw, Trash2, Zap, Brain, AlertTriangle, ExternalLink } from "lucide-react";

const TABS = ["Overview", "Milestones", "Skills", "Tasks", "Coach", "Resources"] as const;
type Tab = (typeof TABS)[number];

export default function GoalWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Overview");
  const [regenerating, setRegenerating] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["goal", id],
    queryFn: () => api.get<{ goal: GoalWorkspaceData }>(`/api/goals/${id}`),
  });

  if (isLoading) return <Spinner className="py-24" />;
  if (isError || !data?.goal) return <EmptyState title="Goal not found" description="It may have been deleted." action={<Link href="/goals" className="btn-outline">Back to goals</Link>} />;

  const g = data.goal;
  const openTasks = g.tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const doneTasks = g.tasks.filter((t) => t.status === "done");
  const doneMilestones = g.milestones.filter((m) => m.status === "done").length;

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await api.post<{ needsClarification: boolean; provider: string; fallbackReason: string | null }>(
        `/api/goals/${id}/decompose`,
        {},
      );
      if (res.needsClarification) {
        toast.push({ kind: "info", title: "Needs clarification", body: "Open 'New goal' flow to answer — or edit the goal text." });
      } else {
        toast.push({ kind: "success", title: "Plan regenerated", body: res.provider === "ai" ? "AI plan updated" : "Rules-based plan updated" });
      }
      qc.invalidateQueries({ queryKey: ["goal", id] });
    } catch (err) {
      toast.push({ kind: "error", title: "Regenerate failed", body: err instanceof ApiClientError ? err.message : "Try again" });
    } finally {
      setRegenerating(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this goal and all its milestones, skills and tasks? This cannot be undone.")) return;
    await api.del(`/api/goals/${id}`);
    qc.invalidateQueries({ queryKey: ["goals"] });
    router.push("/goals");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/goals" className="text-xs text-muted hover:text-fg">← Goals</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{g.category}</Badge>
              <Badge>{g.status}</Badge>
              <Badge tone={g.aiModel ? "success" : "neutral"}>
                {g.aiModel ? <><Brain className="h-3 w-3" /> AI plan</> : <><Zap className="h-3 w-3" /> rules-based plan</>}
              </Badge>
              <span className="text-[11px] text-muted">confidence {g.confidence}%</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{g.title}</h1>
            {g.summary && <p className="mt-1 max-w-2xl text-sm text-muted">{g.summary}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={regenerate} loading={regenerating}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
            <Button variant="ghost" onClick={remove} aria-label="Delete goal" className="text-danger">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Progress" value={`${Math.round(g.progressPct)}%`} hint={`Level ${g.level}`} />
        <Stat label="Milestones" value={`${doneMilestones}/${g.milestones.length}`} />
        <Stat label="Open tasks" value={openTasks.length} hint={`${doneTasks.length} done`} />
        <Stat
          label={g.metricName ?? "Timeline"}
          value={g.metricName ? `${g.metricCurrent ?? g.metricStart ?? 0}` : `${g.timelineWeeks ?? "—"}w`}
          hint={g.metricName ? `target ${g.metricTarget}` : g.targetDate ? `by ${new Date(g.targetDate).toLocaleDateString()}` : "no deadline"}
        />
      </div>

      <Progress value={g.progressPct} />

      {g.aiRecommendations.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {g.aiRecommendations.map((r) => (
            <RecommendationCard key={r.id} rec={{ id: r.id, kind: r.kind, title: r.title, body: r.body, priority: r.priority }} />
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition",
              tab === t ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHeading title="Milestones" />
            {g.milestones.length ? <MilestoneTimeline milestones={g.milestones} /> : <p className="text-sm text-muted">No milestones.</p>}
          </div>
          <div className="space-y-6">
            <div>
              <SectionHeading title="Next up" />
              <div className="space-y-2">
                {openTasks.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={toRow(t, g.title)} invalidateKeys={[["goal", id], ["dashboard"]]} />
                ))}
                {openTasks.length === 0 && <p className="text-sm text-muted">All caught up. Regenerate for more, or add tasks in the Tasks tab.</p>}
              </div>
            </div>
            {g.progressSnapshots.length > 1 && (
              <div>
                <SectionHeading title="Progress trend" />
                <div className="card p-4">
                  <TrajectoryChart
                    data={g.progressSnapshots.slice().reverse().map((s) => ({ date: s.date.slice(0, 10), value: Math.round(s.progressPct) }))}
                    label="%"
                    height={180}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Milestones" && (g.milestones.length ? <MilestoneTimeline milestones={g.milestones} /> : <EmptyState title="No milestones yet" />)}

      {tab === "Skills" && (
        g.skills.length ? (
          <SkillTree skills={g.skills.map((s) => ({ ...s, lastPracticedAt: s.lastPracticedAt ?? null }))} />
        ) : (
          <EmptyState title="No skill tree yet" description="Regenerate the plan to build one." />
        )
      )}

      {tab === "Tasks" && (
        <div className="space-y-6">
          <AddTaskInline goalId={id} skills={g.skills.map((s) => ({ id: s.id, name: s.name }))} />
          <div>
            <SectionHeading title={`Open (${openTasks.length})`} />
            <div className="space-y-2">
              {openTasks.map((t) => (
                <TaskRow key={t.id} task={toRow(t, g.title)} invalidateKeys={[["goal", id], ["dashboard"]]} />
              ))}
              {!openTasks.length && <p className="text-sm text-muted">No open tasks.</p>}
            </div>
          </div>
          {doneTasks.length > 0 && (
            <div>
              <SectionHeading title={`Completed (${doneTasks.length})`} />
              <div className="space-y-2 opacity-70">
                {doneTasks.slice(0, 20).map((t) => (
                  <TaskRow key={t.id} task={toRow(t, g.title)} invalidateKeys={[["goal", id]]} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Coach" && <CoachChat goalId={id} compact />}

      {tab === "Resources" && (
        g.resources.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {g.resources.map((r) => (
              <div key={r.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <Badge>{r.type}</Badge>
                  <span className="text-[10px] text-muted">{r.addedBy}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium">{r.title}</p>
                {r.notes && <p className="mt-0.5 text-[11px] text-muted">{r.notes}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand hover:underline">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="No resources yet" description="AI plans include curated resources. Regenerate with an API key configured." />
        )
      )}
    </div>
  );
}

function toRow(t: TaskData, goalTitle: string) {
  return {
    id: t.id,
    title: t.title,
    goalTitle,
    skill: t.skill?.name ?? null,
    priority: t.priority,
    type: t.type,
    estimatedMinutes: t.estimatedMinutes,
    xpReward: t.xpReward,
    status: t.status,
  };
}

function AddTaskInline({ goalId, skills }: { goalId: string; skills: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [skillId, setSkillId] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/tasks", { goalId, title: title.trim(), skillId: skillId || null });
      setTitle("");
      setSkillId("");
      qc.invalidateQueries({ queryKey: ["goal", goalId] });
      toast.push({ kind: "success", title: "Task added" });
    } catch (err) {
      toast.push({ kind: "error", title: "Couldn't add task", body: err instanceof ApiClientError ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="flex flex-wrap gap-2 rounded-md border border-border bg-surface p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add your own task…" className="input flex-1" />
      <select value={skillId} onChange={(e) => setSkillId(e.target.value)} className="input w-auto">
        <option value="">No skill</option>
        {skills.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <Button type="submit" loading={busy} variant="outline">Add</Button>
    </form>
  );
}

// ── types ──
interface TaskData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  difficulty: number;
  estimatedMinutes: number;
  xpReward: number;
  skill?: { name: string } | null;
}
interface GoalWorkspaceData {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  status: string;
  difficulty: number;
  level: number;
  progressPct: number;
  confidence: number;
  aiModel: string | null;
  timelineWeeks: number | null;
  targetDate: string | null;
  metricName: string | null;
  metricStart: number | null;
  metricTarget: number | null;
  metricCurrent: number | null;
  milestones: { id: string; title: string; description: string | null; status: string; targetLevel: number; dueDate: string | null; xpReward: number }[];
  skills: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    parentId: string | null;
    level: number;
    mastery: number;
    confidence: number;
    lastPracticedAt: string | null;
    prerequisites: { prerequisite: { id: string; name: string } }[];
  }[];
  tasks: TaskData[];
  resources: { id: string; title: string; url: string | null; type: string; notes: string | null; addedBy: string }[];
  aiRecommendations: { id: string; kind: string; title: string; body: string; priority: number }[];
  progressSnapshots: { date: string; progressPct: number; xp: number }[];
}
