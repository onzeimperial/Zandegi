import type { CSSProperties } from "react";
import { RARITY_COLORS, RARITY_LABELS, RARITIES, type Rarity } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Border treatment for a card holding an item of this rarity. */
export function rarityRingStyle(rarity: Rarity): CSSProperties {
  const color = RARITY_COLORS[rarity];
  const rank = RARITIES.indexOf(rarity);
  return {
    borderColor: color,
    // Higher tiers get a progressively stronger halo.
    boxShadow: rank >= 3 ? `0 0 0 1px ${color}33, 0 0 14px ${color}44` : undefined,
  };
}

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  const color = RARITY_COLORS[rarity];
  return (
    <span
      className={cn(
        "mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
      style={{ color, background: `${color}1f` }}
    >
      {RARITY_LABELS[rarity]}
    </span>
  );
}

export function RarityDot({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: RARITY_COLORS[rarity] }}
      aria-label={RARITY_LABELS[rarity]}
    />
  );
}
