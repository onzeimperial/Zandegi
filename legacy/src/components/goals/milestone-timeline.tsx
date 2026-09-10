"use client";

import { cn } from "@/lib/utils";
import { Check, Circle, Lock } from "lucide-react";

export interface MilestoneItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  targetLevel: number;
  dueDate: string | null;
  xpReward: number;
}

export function MilestoneTimeline({ milestones }: { milestones: MilestoneItem[] }) {
  return (
    <ol className="relative">
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1;
        return (
          <li key={m.id} className="relative flex gap-4 pb-6">
            {!isLast && <span className="absolute left-[15px] top-8 h-full w-px bg-border" />}
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                m.status === "done" && "border-success bg-success text-white",
                m.status === "active" && "border-brand bg-brand-soft text-brand",
                m.status === "locked" && "border-border bg-surface text-muted",
              )}
            >
              {m.status === "done" ? <Check className="h-4 w-4" /> : m.status === "locked" ? <Lock className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn("text-sm font-medium", m.status === "locked" && "text-muted")}>{m.title}</p>
                <span className="text-[11px] text-muted">+{m.xpReward} XP</span>
                {m.dueDate && <span className="text-[11px] text-muted">· {new Date(m.dueDate).toLocaleDateString()}</span>}
              </div>
              {m.description && <p className="mt-1 text-xs text-muted">{m.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
