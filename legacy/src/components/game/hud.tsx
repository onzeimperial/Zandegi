"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface QuestsResponse {
  dailyGoal: { target: number; earned: number; pct: number; met: boolean };
  streak: { current: number };
}

interface ProfileResponse {
  profile: { level: number };
}

/**
 * Fixed top HUD — streak, today's XP against today's target, current level.
 * All three numbers are real: dailyGoal and streak come from
 * /api/quests (src/server/engagement/service.ts), level from the Profile
 * row itself. Nothing here is invented or estimated.
 */
export function Hud() {
  const { data: quests } = useQuery({
    queryKey: ["daily"],
    queryFn: () => api.get<QuestsResponse>("/api/quests"),
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileResponse>("/api/profile"),
  });

  const streakCurrent = quests?.streak.current ?? 0;
  const goal = quests?.dailyGoal;
  const level = profile?.profile.level ?? 1;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-game-surface-hi bg-game-void/90 px-4 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <Flame
          className={cn("h-4 w-4", streakCurrent > 0 ? "text-game-magenta" : "text-game-text-dim")}
          fill={streakCurrent > 0 ? "currentColor" : "none"}
        />
        <span
          className={cn(
            "font-game-display text-sm font-extrabold tabular-nums",
            streakCurrent > 0 ? "text-game-magenta" : "text-game-text-dim",
          )}
        >
          {streakCurrent}
        </span>
      </div>

      <div className="flex flex-1 items-center gap-2">
        <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-game-surface-hi">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              goal?.met ? "bg-game-cyan" : "bg-game-violet",
            )}
            style={{ width: `${goal?.pct ?? 0}%` }}
          />
        </div>
        <span className="shrink-0 font-game-body text-xs tabular-nums text-game-text-dim">
          {goal ? `${goal.earned}/${goal.target} XP` : "—"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 rounded-full bg-game-surface-hi px-2.5 py-1">
        <span className="font-game-body text-[10px] uppercase tracking-wide text-game-text-dim">Lv</span>
        <span className="font-game-display text-sm font-extrabold tabular-nums text-game-cyan">
          {level}
        </span>
      </div>
    </header>
  );
}
