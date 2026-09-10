import { formatDistanceToNowStrict } from "date-fns";
import { Flag, Trophy, TrendingUp, Award, Sparkles } from "lucide-react";
import { AvatarRender } from "@/components/avatar/avatar-render";
import { RARITY_COLORS } from "@/lib/constants";
import type { ActivityFeedItem } from "@/server/crew/service";

/**
 * The left-border colour: a real cosmetic drop uses its real rarity colour
 * (RARITY_COLORS — the same 6-tier system used everywhere drops appear).
 * The other event kinds have no genuine "rarity" of their own — a milestone
 * or a level-up isn't an item — so they get a fixed per-kind accent instead
 * of a fabricated rarity.
 */
const KIND_COLOR: Record<string, string> = {
  milestone_complete: "rgb(var(--g-violet))",
  goal_complete: "rgb(var(--g-legendary))",
  level_up: "rgb(var(--g-cyan))",
  achievement_unlock: "rgb(var(--g-epic))",
};

const KIND_ICON: Record<string, typeof Flag> = {
  milestone_complete: Flag,
  goal_complete: Trophy,
  level_up: TrendingUp,
  achievement_unlock: Award,
  cosmetic_drop: Sparkles,
};

function lowerFirst(s: string): string {
  return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function ActivityFeedRow({ item }: { item: ActivityFeedItem }) {
  const color = item.rarity ? RARITY_COLORS[item.rarity] : (KIND_COLOR[item.kind] ?? "rgb(var(--g-text-dim))");
  const Icon = KIND_ICON[item.kind] ?? Sparkles;

  return (
    <div
      className="flex items-center gap-3 border-l-2 py-2.5 pl-3"
      style={{ borderColor: color }}
    >
      <AvatarRender config={item.actorAvatar} size={28} />
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
      <p className="min-w-0 flex-1 font-game-body text-sm">
        <span className="font-semibold">{item.actorName}</span>{" "}
        <span className="text-game-text-dim">{lowerFirst(item.title)}</span>
      </p>
      <span className="shrink-0 font-game-body text-[11px] text-game-text-dim">
        {formatDistanceToNowStrict(new Date(item.createdAt))} ago
      </span>
    </div>
  );
}
