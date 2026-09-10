"use client";

import { cn } from "@/lib/utils";
import type { MissionSummary } from "@/server/path/types";

export function MissionSwitcher({
  missions,
  onSelect,
}: {
  missions: MissionSummary[];
  onSelect: (goalId: string) => void;
}) {
  if (missions.length <= 1) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Active missions">
      {missions.map((m) => (
        <button
          key={m.goalId}
          type="button"
          role="tab"
          aria-selected={m.isSelected}
          onClick={() => onSelect(m.goalId)}
          className={cn(
            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 font-game-body text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-game-cyan",
            m.isSelected
              ? "border-transparent text-game-void"
              : "border-game-surface-hi bg-game-surface text-game-text-dim hover:text-game-text",
          )}
          style={m.isSelected ? { background: m.color } : undefined}
        >
          {m.title}
          <span className="tabular-nums opacity-70">{Math.round(m.progressPct)}%</span>
        </button>
      ))}
    </div>
  );
}
