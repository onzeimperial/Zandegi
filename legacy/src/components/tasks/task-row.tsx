"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Clock, Zap, ChevronDown } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { cn, formatMinutes } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/primitives";
import { RewardReveal, type Drop } from "@/components/avatar/reward-reveal";
import { LevelUpModal, type LevelUpInfo } from "@/components/progression/level-up";

export interface TaskRowData {
  id: string;
  title: string;
  goalTitle?: string;
  skill?: string | null;
  priority: string;
  type: string;
  estimatedMinutes: number;
  xpReward: number;
  status: string;
}

const priorityTone: Record<string, "neutral" | "warning" | "danger" | "brand"> = {
  low: "neutral",
  medium: "brand",
  high: "warning",
  critical: "danger",
};

export function TaskRow({
  task,
  onDone,
  invalidateKeys = [["dashboard"]],
}: {
  task: TaskRowData;
  onDone?: () => void;
  invalidateKeys?: unknown[][];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [performance, setPerformance] = useState<number | "">("");
  const [minutes, setMinutes] = useState<number | "">("");
  const [reveal, setReveal] = useState<Drop[]>([]);
  const [levelUp, setLevelUp] = useState<LevelUpInfo | null>(null);
  const done = task.status === "done";

  async function complete() {
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await api.post<{
        xpAwarded: number;
        levelUp: boolean;
        newLevel: number;
        streak: { current: number; bonusXp: number };
        milestoneCompleted: { title: string } | null;
        unlockedAchievements: { name: string; xpReward: number }[];
        coinsAwarded: number;
        goalCompleted: boolean;
        drops: Drop[];
      }>(`/api/tasks/${task.id}/complete`, {
        performance: performance === "" ? null : performance,
        minutesSpent: minutes === "" ? null : minutes,
      });

      toast.push({ kind: "xp", title: `+${res.xpAwarded} XP`, body: task.title });
      if (res.coinsAwarded > 0) toast.push({ kind: "xp", title: `+${res.coinsAwarded} coins` });
      if (res.streak.bonusXp > 0) toast.push({ kind: "xp", title: `Streak bonus +${res.streak.bonusXp} XP`, body: `${res.streak.current}-day streak` });
      if (res.levelUp) {
        setLevelUp({
          from: res.newLevel - 1,
          to: res.newLevel,
          coinsAwarded: res.coinsAwarded,
        });
      }
      if (res.milestoneCompleted) toast.push({ kind: "success", title: `Milestone complete: ${res.milestoneCompleted.title}` });
      if (res.goalCompleted) toast.push({ kind: "success", title: "Goal complete!", body: "Everything's done — nice work." });
      for (const a of res.unlockedAchievements) toast.push({ kind: "success", title: `Achievement: ${a.name}`, body: `+${a.xpReward} XP` });

      if (res.drops?.length) setReveal(res.drops);

      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["avatar"] });
      qc.invalidateQueries({ queryKey: ["shop"] });
      onDone?.();
    } catch (err) {
      toast.push({ kind: "error", title: "Couldn't complete task", body: err instanceof ApiClientError ? err.message : "Try again" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Level-up first, then any drops — the rarer event leads. */}
      {levelUp ? <LevelUpModal info={levelUp} onClose={() => setLevelUp(null)} /> : null}
      {!levelUp && reveal.length > 0 ? (
        <RewardReveal drops={reveal} onClose={() => setReveal([])} />
      ) : null}
    <div className={cn("rounded-md border border-border bg-surface transition", done && "opacity-50")}>
      <div className="flex items-start gap-3 p-3">
        <button
          onClick={complete}
          disabled={busy || done}
          aria-label={done ? "Completed" : "Mark complete"}
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
            done ? "border-success bg-success text-white" : "border-border hover:border-brand hover:text-brand",
            busy && "animate-pulse",
          )}
        >
          {done ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium leading-snug", done && "line-through")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {task.goalTitle && <span className="truncate">{task.goalTitle}</span>}
            {task.skill && <Badge>{task.skill}</Badge>}
            <Badge tone={priorityTone[task.priority] ?? "neutral"}>{task.priority}</Badge>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatMinutes(task.estimatedMinutes)}</span>
            <span className="inline-flex items-center gap-1 text-brand"><Zap className="h-3 w-3" />{task.xpReward}</span>
          </div>
        </div>

        {!done && (
          <button onClick={() => setExpanded((v) => !v)} className="text-muted hover:text-fg" aria-label="Log details">
            <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      {expanded && !done && (
        <div className="grid grid-cols-2 gap-3 border-t border-border p-3">
          <label className="text-[11px] text-muted">
            How did it go? (0–100)
            <input
              type="number" min={0} max={100} value={performance}
              onChange={(e) => setPerformance(e.target.value === "" ? "" : Number(e.target.value))}
              className="input mt-1"
            />
          </label>
          <label className="text-[11px] text-muted">
            Minutes spent
            <input
              type="number" min={0} max={600} value={minutes}
              onChange={(e) => setMinutes(e.target.value === "" ? "" : Number(e.target.value))}
              className="input mt-1"
            />
          </label>
          <button onClick={complete} disabled={busy} className="btn-primary col-span-2">
            Complete with these details
          </button>
        </div>
      )}
    </div>
    </>
  );
}
