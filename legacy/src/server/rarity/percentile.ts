/**
 * Percentile-based rarity — pure maths, unit tested (test/percentile.test.ts).
 *
 * This is a second, independent rarity system from the existing 6-tier
 * authored cosmetic drop rarity in src/lib/constants.ts (RARITIES). That one
 * is authored and drives what a goal-completion gifts. This one is a 5-tier
 * ladder computed purely from real unlock counts, used for achievement and
 * mission cards on the Character page — "rarer than 94% of players" instead
 * of a hand-picked badge.
 */

export const PERCENTILE_TIERS = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type PercentileTier = (typeof PERCENTILE_TIERS)[number];

/** Below this many total accounts, a percentile is statistical noise. */
export const MIN_ACCOUNTS_FOR_PERCENTILE = 20;

/** Upper bound (exclusive) of the fraction of accounts that hold a tier. */
const CUTOFFS: Record<Exclude<PercentileTier, "common">, number> = {
  legendary: 0.02,
  epic: 0.1,
  rare: 0.25,
  uncommon: 0.5,
};

/**
 * Tier from a real unlock fraction. 0 unlocked-of-total is treated as
 * legendary (nobody has it yet, which is the rarest possible state), and the
 * fraction is clamped to [0, 1] so bad inputs cannot produce a bogus tier.
 */
export function tierFromFraction(fraction: number): PercentileTier {
  const f = Math.min(1, Math.max(0, fraction));
  if (f <= CUTOFFS.legendary) return "legendary";
  if (f <= CUTOFFS.epic) return "epic";
  if (f <= CUTOFFS.rare) return "rare";
  if (f <= CUTOFFS.uncommon) return "uncommon";
  return "common";
}

/** The authored bronze..platinum achievement tier, mapped onto the 5-rung ladder. */
export function tierFromAuthored(authored: "bronze" | "silver" | "gold" | "platinum"): PercentileTier {
  switch (authored) {
    case "platinum":
      return "legendary";
    case "gold":
      return "epic";
    case "silver":
      return "rare";
    case "bronze":
      return "uncommon";
  }
}

export interface PercentileResult {
  tier: PercentileTier;
  /** Null when falling back to an authored tier — there is no real percentile yet. */
  percentile: number | null;
  /** True when totalAccounts was too small to trust a computed percentile. */
  isProvisional: boolean;
}

/**
 * The rarity actually shown to a user. Falls back to the authored tier below
 * MIN_ACCOUNTS_FOR_PERCENTILE so the UI never presents a percentile computed
 * from a handful of accounts as if it meant something.
 */
export function resolveTier(params: {
  unlockedCount: number;
  totalAccounts: number;
  authoredTier: "bronze" | "silver" | "gold" | "platinum";
}): PercentileResult {
  if (params.totalAccounts < MIN_ACCOUNTS_FOR_PERCENTILE) {
    return { tier: tierFromAuthored(params.authoredTier), percentile: null, isProvisional: true };
  }

  const fraction = params.unlockedCount / params.totalAccounts;
  return {
    tier: tierFromFraction(fraction),
    percentile: Math.round((1 - Math.min(1, Math.max(0, fraction))) * 100),
    isProvisional: false,
  };
}
