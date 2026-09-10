/**
 * The 8-domain life-star grouping, mapped from the 18 real GOAL_CATEGORIES.
 *
 * Every domain except "bond" is a direct grouping of goal categories, so its
 * XP comes straight from real XpEvent rows. "bond" has no corresponding goal
 * category — nothing in GOAL_CATEGORIES is social — so it is computed from
 * friendships and challenges instead (see bondXp below). That is a genuinely
 * different kind of number from the other seven and is documented as such
 * everywhere it is used.
 */

import type { GoalCategory } from "@/lib/constants";

export const DOMAINS = ["mind", "edge", "coin", "body", "grit", "craft", "bond", "world"] as const;
export type Domain = (typeof DOMAINS)[number];

/**
 * One accent colour per domain, for the mission switcher, track chapters
 * and life-star vertices. Distinct from the game shell's brand tokens
 * (violet/cyan/magenta) and from the percentile rarity ladder — this is its
 * own small palette, chosen for 8-way distinguishability rather than tied to
 * any other system's meaning.
 */
export const DOMAIN_COLORS: Record<Domain, string> = {
  mind: "#7B9CFB",
  edge: "#F0399A",
  coin: "#FFC94A",
  body: "#22D3EE",
  grit: "#FF6B4A",
  craft: "#3FD16B",
  bond: "#C084FC",
  world: "#7B2FF7",
};

export const DOMAIN_LABELS: Record<Domain, string> = {
  mind: "Mind",
  edge: "Edge",
  coin: "Coin",
  body: "Body",
  grit: "Grit",
  craft: "Craft",
  bond: "Bond",
  world: "World",
};

/** Categories with no domain (bond) are intentionally absent from this map. */
export const CATEGORY_TO_DOMAIN: Partial<Record<GoalCategory, Domain>> = {
  education: "mind",
  research: "mind",
  language: "mind",

  exam: "edge",
  certification: "edge",
  competition: "edge",

  finance: "coin",
  business: "coin",

  fitness: "body",
  sport: "body",

  habit: "grit",
  personal_development: "grit",

  programming: "craft",
  creative: "craft",
  music: "craft",
  project: "craft",

  career: "world",
  general: "world",
};

export function domainForCategory(category: GoalCategory): Domain | null {
  return CATEGORY_TO_DOMAIN[category] ?? null;
}

/** Every domain that draws directly from goal-category XP (i.e. not bond). */
export const CATEGORY_DOMAINS: Domain[] = DOMAINS.filter((d) => d !== "bond");
