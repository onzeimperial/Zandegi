import { Lock } from "lucide-react";
import { AchievementIcon } from "@/components/ui/icon";
import { Panel } from "./panel";
import { PERCENTILE_TIER_COLOR } from "./rarity-color";
import type { CharacterAchievement } from "@/server/character/service";

export function AchievementGrid({ achievements }: { achievements: CharacterAchievement[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {achievements.map((a) => (
        <AchievementTile key={a.key} achievement={a} />
      ))}
    </div>
  );
}

function AchievementTile({ achievement: a }: { achievement: CharacterAchievement }) {
  const color = PERCENTILE_TIER_COLOR[a.tier];

  return (
    <Panel accent={color} glow={a.unlocked} className="flex flex-col items-center gap-2 p-3 text-center">
      <span
        className="grid h-11 w-11 place-items-center rounded-full"
        style={{ background: `${color}22`, color: a.unlocked ? color : "rgb(var(--g-text-dim))" }}
      >
        {a.unlocked ? (
          <AchievementIcon name={a.icon} className="h-5 w-5" />
        ) : (
          <Lock className="h-4 w-4 opacity-60" />
        )}
      </span>

      <p
        className="font-game-body text-xs font-semibold"
        style={{ color: a.unlocked ? undefined : "rgb(var(--g-text-dim))" }}
      >
        {a.name}
      </p>

      <p className="font-game-body text-[10px] uppercase tracking-wide" style={{ color }}>
        {a.tier}
        {a.percentile != null ? ` · rarer than ${a.percentile}%` : ""}
        {a.isProvisional ? " (early)" : ""}
      </p>

      {!a.unlocked ? (
        <p className="font-game-body text-[11px] leading-snug text-game-text-dim">{a.description}</p>
      ) : null}
    </Panel>
  );
}
