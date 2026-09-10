/**
 * Rarity tiers (SPEC §4.3). Rarity is a **population percentile of
 * achievement**, computed from real completion counts — never authored
 * (CLAUDE.md §2.5). This file only maps a population fraction to a tier and
 * to the exclusivity score the XP formula uses.
 */

export const RARITY_TIERS = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
] as const;

export type RarityTier = (typeof RARITY_TIERS)[number];

/** Hex per tier, except Mythic which the UI renders as an animated gradient. */
export const RARITY_COLOR: Record<RarityTier, string> = {
  Common: "#9BA1AE",
  Uncommon: "#3FCF8E",
  Rare: "#5B9DFF",
  Epic: "#A855F7",
  Legendary: "#F5C451",
  Mythic: "prismatic",
};

/**
 * `fraction` is the share of the cohort that has done it, in [0, 1].
 * Boundaries follow SPEC §4.3 (upper bound inclusive going down the table):
 *   Common     > 0.40
 *   Uncommon   0.15 – 0.40
 *   Rare       0.05 – 0.15
 *   Epic       0.01 – 0.05
 *   Legendary  0.001 – 0.01
 *   Mythic     < 0.001
 */
export function rarityTierFromPopulation(fraction: number): RarityTier {
  const f = Math.min(1, Math.max(0, fraction));
  if (f > 0.4) return "Common";
  if (f > 0.15) return "Uncommon";
  if (f > 0.05) return "Rare";
  if (f > 0.01) return "Epic";
  if (f > 0.001) return "Legendary";
  return "Mythic";
}

/**
 * Exclusivity score in [0, 1] for the XP formula: `1 − fraction`. A marathon
 * done by 0.7% of users scores 0.993 and pays close to the full rarity bonus.
 */
export function rarityScoreFromPopulation(fraction: number): number {
  return 1 - Math.min(1, Math.max(0, fraction));
}

/** The share-card line: "Only 0.7% of Zandegi have finished a marathon." */
export function rarityHeadline(fraction: number, achievementPhrase: string): string {
  const pct = Math.min(1, Math.max(0, fraction)) * 100;
  const shown = pct >= 1 ? pct.toFixed(0) : pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(2);
  return `Only ${shown}% of Zandegi have ${achievementPhrase}.`;
}
