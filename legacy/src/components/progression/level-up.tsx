"use client";

import { useEffect, useState } from "react";
import { X, Coins, TrendingUp } from "lucide-react";
import { rankForLevel, levelsToNextRank } from "@/server/xp/ranks";

export interface LevelUpInfo {
  from: number;
  to: number;
  coinsAwarded: number;
}

/**
 * Shown when a task completion pushes the account to a new level. Calls out a
 * rank promotion separately, since crossing a rank band is the rarer and more
 * meaningful event.
 */
export function LevelUpModal({ info, onClose }: { info: LevelUpInfo; onClose: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, []);

  const fromRank = rankForLevel(info.from);
  const toRank = rankForLevel(info.to);
  const promoted = fromRank.name !== toRank.name;
  const toNext = levelsToNextRank(info.to);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${info.to} reached`}
      onClick={onClose}
    >
      <div
        className="card relative w-full max-w-sm p-6 text-center transition-all duration-300"
        style={{
          borderColor: toRank.color,
          boxShadow: `0 0 0 1px ${toRank.color}44, 0 0 40px ${toRank.color}55`,
          transform: shown ? "scale(1)" : "scale(0.9)",
          opacity: shown ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-muted hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <TrendingUp className="h-3.5 w-3.5" />
          {promoted ? "Rank up" : "Level up"}
        </p>

        <div className="my-5 flex items-center justify-center gap-4">
          <span className="text-3xl font-semibold text-muted">{info.from}</span>
          <span className="text-muted">→</span>
          <span
            className="grid h-20 w-20 place-items-center rounded-full text-4xl font-bold"
            style={{ color: toRank.color, background: `${toRank.color}1f` }}
          >
            {info.to}
          </span>
        </div>

        <p
          className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
          style={{ color: toRank.color, background: `${toRank.color}1f` }}
        >
          {toRank.name}
        </p>

        {promoted ? (
          <p className="mt-2 text-sm text-muted">
            You've moved up from {fromRank.name} to {toRank.name}.
          </p>
        ) : toNext != null ? (
          <p className="mt-2 text-sm text-muted">
            {toNext} more level{toNext === 1 ? "" : "s"} to {rankForLevel(info.to + toNext).name}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">You're at the highest rank.</p>
        )}

        {info.coinsAwarded > 0 ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
            <Coins className="h-4 w-4 text-brand" />+{info.coinsAwarded.toLocaleString()} coins
          </p>
        ) : null}

        <button onClick={onClose} className="btn-primary mt-5 w-full">
          Keep going
        </button>
      </div>
    </div>
  );
}

/** Small inline rank badge for cards and headers. */
export function RankBadge({ level, className }: { level: number; className?: string }) {
  const rank = rankForLevel(level);
  return (
    <span
      className={className}
      style={{
        color: rank.color,
        background: `${rank.color}1f`,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {rank.name}
    </span>
  );
}
