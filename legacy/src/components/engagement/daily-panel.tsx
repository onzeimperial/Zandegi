"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Zap,
  Clock,
  Target,
  Flag,
  Sunrise,
  Star,
  Coins,
  Flame,
  Snowflake,
  type LucideIcon,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Progress } from "@/components/ui/primitives";

const QUEST_ICONS: Record<string, LucideIcon> = {
  check: Check,
  zap: Zap,
  clock: Clock,
  target: Target,
  flag: Flag,
  sunrise: Sunrise,
  star: Star,
};

interface Quest {
  key: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  complete: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardXp: number;
}

interface DailyResponse {
  quests: Quest[];
  dailyGoal: { target: number; earned: number; pct: number; met: boolean };
  streak: {
    current: number;
    freezes: number;
    maxFreezes: number;
    canBuy: boolean;
    price: number;
    atRisk: boolean;
  };
}

export function DailyPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["daily"],
    queryFn: () => api.get<DailyResponse>("/api/quests"),
  });

  if (!data) return null;

  async function claim(q: Quest) {
    setBusy(q.key);
    try {
      const res = await api.post<{ reward: { coins: number; xp: number } }>("/api/quests", {
        key: q.key,
      });
      toast.push({
        kind: "success",
        title: `Quest complete: ${q.title}`,
        body: `+${res.reward.coins} coins${res.reward.xp ? ` · +${res.reward.xp} XP` : ""}`,
      });
      qc.invalidateQueries({ queryKey: ["daily"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.push({
        kind: "error",
        title: e instanceof ApiClientError ? e.message : "Couldn't claim that",
      });
    } finally {
      setBusy(null);
    }
  }

  async function buyFreeze() {
    setBusy("freeze");
    try {
      await api.post("/api/streak", { action: "buy_freeze" });
      toast.push({ kind: "success", title: "Streak freeze bought" });
      qc.invalidateQueries({ queryKey: ["daily"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.push({
        kind: "error",
        title: e instanceof ApiClientError ? e.message : "Couldn't buy a freeze",
      });
    } finally {
      setBusy(null);
    }
  }

  const g = data.dailyGoal;

  return (
    <section className="card space-y-4 p-4">
      {/* ── Daily XP goal ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Daily goal</span>
          <span className={cn("tabular-nums", g.met ? "text-success" : "text-muted")}>
            {g.earned} / {g.target} XP
          </span>
        </div>
        <Progress value={g.pct} tone={g.met ? "success" : "brand"} className="mt-2" />
        {g.met ? (
          <p className="mt-1 text-xs text-success">Daily goal hit. Anything more is a bonus.</p>
        ) : (
          <p className="mt-1 text-xs text-muted">{g.target - g.earned} XP to go today.</p>
        )}
      </div>

      {/* ── Streak ────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm">
          <Flame className={cn("h-4 w-4", data.streak.current > 0 ? "text-warning" : "text-muted")} />
          <span className="font-medium">{data.streak.current}-day streak</span>
          {data.streak.atRisk && data.streak.current > 0 ? (
            <span className="text-xs text-warning">at risk today</span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted" title="Streak freezes">
            <Snowflake className="h-3.5 w-3.5" />
            {data.streak.freezes}/{data.streak.maxFreezes}
          </span>
          {data.streak.canBuy ? (
            <button
              onClick={buyFreeze}
              disabled={busy !== null}
              className="btn-outline px-2 py-1 text-xs"
              title="A freeze protects your streak if you miss a day"
            >
              <Coins className="h-3 w-3" /> {data.streak.price}
            </button>
          ) : null}
        </span>
      </div>

      {/* ── Quests ────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-sm font-medium">Today's quests</p>
        <div className="space-y-2">
          {data.quests.map((q) => {
            const Icon = QUEST_ICONS[q.icon] ?? Check;
            const pct = Math.round((q.progress / q.target) * 100);
            return (
              <div
                key={q.key}
                className={cn(
                  "rounded-md border border-border p-2.5",
                  q.claimed && "opacity-60",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      q.complete ? "bg-success/15 text-success" : "bg-surface-2 text-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{q.description}</p>
                    <p className="text-[11px] text-muted">
                      {q.progress}/{q.target} · +{q.rewardCoins} coins
                      {q.rewardXp ? ` · +${q.rewardXp} XP` : ""}
                    </p>
                  </div>
                  {q.claimed ? (
                    <span className="shrink-0 text-xs font-medium text-success">Claimed</span>
                  ) : q.complete ? (
                    <button
                      onClick={() => claim(q)}
                      disabled={busy !== null}
                      className="btn-primary shrink-0 px-2.5 py-1 text-xs"
                    >
                      {busy === q.key ? "…" : "Claim"}
                    </button>
                  ) : null}
                </div>
                {!q.complete ? <Progress value={pct} className="mt-2 h-1.5" /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
