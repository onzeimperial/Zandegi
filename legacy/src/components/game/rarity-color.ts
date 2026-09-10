import type { PercentileTier } from "@/server/rarity/percentile";

/**
 * CSS colour for the 5-tier percentile ladder, using the CSS vars defined
 * in game-tokens.css (--g-common..--g-legendary). Kept separate from the
 * domain colours and from the existing 6-tier cosmetic drop rarity.
 */
export const PERCENTILE_TIER_COLOR: Record<PercentileTier, string> = {
  common: "rgb(var(--g-common))",
  uncommon: "rgb(var(--g-uncommon))",
  rare: "rgb(var(--g-rare))",
  epic: "rgb(var(--g-epic))",
  legendary: "rgb(var(--g-legendary))",
};
