"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Spinner, Stat, Progress, Badge } from "@/components/ui/primitives";
import { AchievementIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface Item {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  xpReward: number;
  secret: boolean;
  progress: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

const tierRing: Record<string, string> = {
  bronze: "ring-amber-700/40",
  silver: "ring-slate-400/50",
  gold: "ring-yellow-500/60",
  platinum: "ring-cyan-400/60",
};

const CATS = ["all", "consistency", "mastery", "milestone", "social", "meta"];

export default function AchievementsPage() {
  const [cat, setCat] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get<{ items: Item[]; summary: { unlocked: number; total: number; xpFromAchievements: number } }>("/api/achievements"),
  });

  if (isLoading) return <Spinner className="py-24" />;
  if (!data) return null;

  const items = data.items.filter((i) => cat === "all" || i.category === cat);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="mt-1 text-sm text-muted">{data.summary.unlocked} of {data.summary.total} unlocked</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Unlocked" value={`${data.summary.unlocked}/${data.summary.total}`} />
        <Stat label="Completion" value={`${Math.round((data.summary.unlocked / data.summary.total) * 100)}%`} />
        <Stat label="XP from achievements" value={data.summary.xpFromAchievements} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full px-3 py-1 text-xs capitalize",
              cat === c ? "bg-brand text-white" : "border border-border text-muted hover:text-fg",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => {
          const hidden = a.secret && !a.unlocked && a.progress < 100;
          return (
            <div
              key={a.key}
              className={cn(
                "card flex gap-3 p-4 transition",
                a.unlocked ? cn("ring-1", tierRing[a.tier]) : "opacity-80",
              )}
            >
              <div
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-lg",
                  a.unlocked ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted",
                )}
              >
                <AchievementIcon name={hidden ? "sparkles" : a.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{hidden ? "Secret achievement" : a.name}</p>
                  <Badge tone={a.unlocked ? "success" : "neutral"}>{a.tier}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">{hidden ? "Keep going to reveal this one." : a.description}</p>
                {!a.unlocked && !hidden && (
                  <>
                    <Progress value={a.progress} className="mt-2" />
                    <p className="mt-1 text-[10px] text-muted">{a.progress}% · +{a.xpReward} XP</p>
                  </>
                )}
                {a.unlocked && (
                  <p className="mt-1.5 text-[10px] text-success">
                    Unlocked{a.unlockedAt ? ` ${new Date(a.unlockedAt).toLocaleDateString()}` : ""} · +{a.xpReward} XP
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
