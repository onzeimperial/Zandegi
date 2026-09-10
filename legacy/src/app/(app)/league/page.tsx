"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, Trophy, Clock } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner, EmptyState } from "@/components/ui/primitives";
import { AvatarRender, type AvatarConfig } from "@/components/avatar/avatar-render";
import { DIVISIONS, DIVISION_LABELS, DIVISION_COLORS, type Division } from "@/lib/constants";

interface Row {
  userId: string;
  name: string;
  avatar: AvatarConfig;
  xp: number;
  rank: number;
  isYou: boolean;
}

interface LeagueResponse {
  division: Division;
  seasonIndex: number;
  endsAt: string;
  yourRank: number;
  yourXp: number;
  promoteCount: number;
  relegateCount: number;
  relegationApplies: boolean;
  rows: Row[];
  lastOutcome: string | null;
}

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "ending now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export default function LeaguePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["league"],
    queryFn: () => api.get<LeagueResponse>("/api/league"),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return <Spinner className="py-24" />;

  const color = DIVISION_COLORS[data.division];
  const relegationFrom = data.rows.length - data.relegateCount;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="text-center">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full"
          style={{ background: `${color}1f`, color }}
        >
          <Trophy className="h-8 w-8" />
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color }}>
          {DIVISION_LABELS[data.division]} League
        </h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
          <Clock className="h-3.5 w-3.5" />
          {timeLeft(data.endsAt)}
        </p>
      </header>

      {/* Division ladder */}
      <div className="flex items-center justify-center gap-1.5">
        {DIVISIONS.map((d) => (
          <span
            key={d}
            title={DIVISION_LABELS[d]}
            className={cn(
              "h-2 flex-1 rounded-full transition-opacity",
              d === data.division ? "opacity-100" : "opacity-25",
            )}
            style={{ background: DIVISION_COLORS[d] }}
          />
        ))}
      </div>

      {data.lastOutcome ? (
        <div
          className="card p-3 text-center text-sm"
          style={{
            borderColor:
              data.lastOutcome === "promoted"
                ? "#22c55e"
                : data.lastOutcome === "relegated"
                  ? "#ef4444"
                  : undefined,
          }}
        >
          {data.lastOutcome === "promoted"
            ? "You were promoted last week. Nicely done."
            : data.lastOutcome === "relegated"
              ? "You were relegated last week — climb back up."
              : "You held your division last week."}
        </div>
      ) : null}

      <div className="card divide-y divide-border overflow-hidden">
        <div className="flex items-center justify-between bg-surface-2 px-4 py-2 text-xs text-muted">
          <span>
            Top {data.promoteCount} promote
            {data.relegationApplies ? ` · bottom ${data.relegateCount} relegate` : ""}
          </span>
          <span>XP this week</span>
        </div>

        {data.rows.length === 0 ? (
          <EmptyState title="Nobody here yet" description="Earn XP to join this week's league." />
        ) : (
          data.rows.map((r) => {
            const promoting = r.rank <= data.promoteCount && r.xp > 0;
            const relegating = data.relegationApplies && r.rank > relegationFrom;
            return (
              <div
                key={r.userId}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  r.isYou && "bg-brand-soft",
                )}
              >
                <span
                  className={cn(
                    "w-6 shrink-0 text-center text-sm font-semibold",
                    promoting && "text-success",
                    relegating && "text-danger",
                  )}
                >
                  {r.rank}
                </span>
                {promoting ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : relegating ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-danger" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <AvatarRender config={r.avatar} size={32} />
                <span className={cn("min-w-0 flex-1 truncate text-sm", r.isYou && "font-semibold")}>
                  {r.name}
                  {r.isYou ? " (you)" : ""}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">{r.xp.toLocaleString()}</span>
              </div>
            );
          })
        )}
      </div>

      <p className="text-center text-xs text-muted">
        Everyone starts in Bronze. Leagues reset every Monday — only XP earned during the week counts.
      </p>
    </div>
  );
}
