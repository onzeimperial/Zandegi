"use client";

import { X, Flag, TrendingUp, Flame } from "lucide-react";
import { Panel } from "./panel";
import type { ChangeEvent } from "@/server/path/types";

/**
 * One dismissible panel, one real change, the most significant since the
 * user's last visit — see consumeWhatChanged in src/server/path/service.ts
 * for exactly what "significant" means and how it's computed.
 */
export function WhatChangedPanel({ event, onDismiss }: { event: ChangeEvent; onDismiss: () => void }) {
  const { icon, text } = describe(event);

  return (
    <Panel accent="rgb(var(--g-cyan))" className="mb-4 p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-game-cyan/15 text-game-cyan">
          {icon}
        </span>
        <p className="min-w-0 flex-1 font-game-body text-sm">{text}</p>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-game-text-dim outline-none hover:text-game-text focus-visible:ring-2 focus-visible:ring-game-cyan"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Panel>
  );
}

function describe(event: ChangeEvent): { icon: React.ReactNode; text: React.ReactNode } {
  switch (event.kind) {
    case "milestone_completed":
      return {
        icon: <Flag className="h-4 w-4" />,
        text: (
          <>
            Milestone complete: <strong>{event.title}</strong> on {event.goalTitle} — +{event.xpReward} XP
          </>
        ),
      };
    case "level_up":
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        text: (
          <>
            You reached <strong>level {event.level}</strong> since you were last here.
          </>
        ),
      };
    case "streak_advanced":
      return {
        icon: <Flame className="h-4 w-4" />,
        text: (
          <>
            Your streak is now <strong>{event.current} days</strong>.
          </>
        ),
      };
  }
}
