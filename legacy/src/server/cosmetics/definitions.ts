/**
 * Static catalogue of avatar cosmetics, synced into the CosmeticItem table by
 * seed — the same pattern as src/server/achievements/definitions.ts.
 *
 * Every `key` MUST exist in the SVG part registry
 * (src/components/avatar/parts/index.ts) or it will render as nothing.
 * test/cosmetics.test.ts asserts the two stay in sync.
 *
 * Pricing shape:
 *   price: number  -> buyable in the shop
 *   price: null    -> only obtainable as a goal-completion drop or an unlock
 */

import type { CosmeticSlot, Rarity } from "@/lib/constants";

export interface CosmeticDef {
  key: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  price: number | null;
  /** Granted to every new user, and never purchasable. */
  isDefault?: boolean;
  /** Requires this Achievement.key to be unlocked first. */
  unlockAchievementKey?: string;
  secret?: boolean;
  sortIndex?: number;
}

export const COSMETICS: CosmeticDef[] = [
  // ── Body (identity, always free) ─────────────────────────
  { key: "base_default", name: "Standard build", description: "The classic silhouette.", slot: "base", rarity: "common", price: null, isDefault: true, sortIndex: 0 },
  { key: "base_slim", name: "Slim build", description: "A leaner frame.", slot: "base", rarity: "common", price: null, isDefault: true, sortIndex: 1 },
  { key: "base_broad", name: "Broad build", description: "Squarer shoulders.", slot: "base", rarity: "common", price: null, isDefault: true, sortIndex: 2 },

  // ── Face ─────────────────────────────────────────────────
  { key: "face_default", name: "Open", description: "Bright and alert.", slot: "face", rarity: "common", price: null, isDefault: true, sortIndex: 0 },
  { key: "face_calm", name: "Calm", description: "Unbothered. Focused.", slot: "face", rarity: "common", price: 150, sortIndex: 1 },
  { key: "face_grin", name: "Grin", description: "Enjoying this far too much.", slot: "face", rarity: "common", price: 200, sortIndex: 2 },
  { key: "face_determined", name: "Determined", description: "Locked in.", slot: "face", rarity: "uncommon", price: 450, sortIndex: 3 },

  // ── Hair ─────────────────────────────────────────────────
  { key: "hair_default", name: "Classic", description: "Simple and tidy.", slot: "hair", rarity: "common", price: null, isDefault: true, sortIndex: 0 },
  { key: "hair_short", name: "Cropped", description: "Low maintenance.", slot: "hair", rarity: "common", price: null, isDefault: true, sortIndex: 1 },
  { key: "hair_long", name: "Flowing", description: "Long and loose.", slot: "hair", rarity: "uncommon", price: 400, sortIndex: 2 },
  { key: "hair_curly", name: "Curls", description: "Voluminous coils.", slot: "hair", rarity: "uncommon", price: 400, sortIndex: 3 },
  { key: "hair_bun", name: "Top knot", description: "Tied back, ready to work.", slot: "hair", rarity: "rare", price: 850, sortIndex: 4 },
  { key: "hair_spiky", name: "Spikes", description: "Gravity is a suggestion.", slot: "hair", rarity: "rare", price: 850, sortIndex: 5 },

  // ── Outfit ───────────────────────────────────────────────
  { key: "outfit_default", name: "Everyday tee", description: "Where everyone starts.", slot: "outfit", rarity: "common", price: null, isDefault: true, sortIndex: 0 },
  { key: "outfit_hoodie", name: "Hoodie", description: "The uniform of deep work.", slot: "outfit", rarity: "uncommon", price: 550, sortIndex: 1 },
  { key: "outfit_athletic", name: "Training kit", description: "Built for the reps.", slot: "outfit", rarity: "uncommon", price: 550, sortIndex: 2 },
  { key: "outfit_blazer", name: "Blazer", description: "For the day it gets serious.", slot: "outfit", rarity: "rare", price: 1100, sortIndex: 3 },
  { key: "outfit_armour", name: "Champion's plate", description: "Earned, not issued.", slot: "outfit", rarity: "epic", price: 2400, sortIndex: 4 },

  // ── Accessory ────────────────────────────────────────────
  { key: "acc_glasses", name: "Spectacles", description: "Sharper focus.", slot: "accessory", rarity: "common", price: 250, sortIndex: 0 },
  { key: "acc_scarf", name: "Scarf", description: "Trails behind you.", slot: "accessory", rarity: "uncommon", price: 500, sortIndex: 1 },
  { key: "acc_headphones", name: "Headphones", description: "Do not disturb.", slot: "accessory", rarity: "rare", price: 950, sortIndex: 2 },
  { key: "acc_visor", name: "Visor", description: "Heads-up display, permanently on.", slot: "accessory", rarity: "epic", price: 2100, sortIndex: 3 },
  { key: "acc_crown", name: "Crown", description: "Awarded for seeing a goal all the way through.", slot: "accessory", rarity: "legendary", price: null, unlockAchievementKey: "goal_completed", sortIndex: 4 },

  // ── Aura ─────────────────────────────────────────────────
  { key: "aura_glow", name: "Glow", description: "A soft halo.", slot: "aura", rarity: "rare", price: 1300, sortIndex: 0 },
  { key: "aura_rings", name: "Orbit", description: "Slowly circling rings.", slot: "aura", rarity: "epic", price: 2600, sortIndex: 1 },
  { key: "aura_sparks", name: "Embers", description: "Drifting sparks of light.", slot: "aura", rarity: "epic", price: 2600, sortIndex: 2 },
  { key: "aura_flame", name: "Inferno", description: "A pulsing corona.", slot: "aura", rarity: "legendary", price: 6500, sortIndex: 3 },
  { key: "aura_cosmic", name: "Cosmos", description: "Only ever found by finishing something enormous.", slot: "aura", rarity: "mythic", price: null, sortIndex: 4 },

  // ── Frame ────────────────────────────────────────────────
  { key: "frame_default", name: "Plain ring", description: "Clean and quiet.", slot: "frame", rarity: "common", price: null, isDefault: true, sortIndex: 0 },
  { key: "frame_thin", name: "Fine ring", description: "A double hairline.", slot: "frame", rarity: "common", price: 200, sortIndex: 1 },
  { key: "frame_studded", name: "Studded", description: "Twelve points of light.", slot: "frame", rarity: "uncommon", price: 650, sortIndex: 2 },
  { key: "frame_laurel", name: "Laurel", description: "The victor's wreath.", slot: "frame", rarity: "rare", price: 1300, sortIndex: 3 },
  { key: "frame_runic", name: "Runic", description: "Turns slowly, for those who reached level 10.", slot: "frame", rarity: "legendary", price: null, unlockAchievementKey: "level_10", sortIndex: 4 },
  { key: "frame_prismatic", name: "Prismatic", description: "Shifts through every colour. Drop only.", slot: "frame", rarity: "mythic", price: null, sortIndex: 5 },
];

export const COSMETIC_BY_KEY = new Map(COSMETICS.map((c) => [c.key, c]));

/** Keys granted to every new account. */
export const DEFAULT_COSMETIC_KEYS = COSMETICS.filter((c) => c.isDefault).map((c) => c.key);

export function cosmeticsForSlot(slot: CosmeticSlot): CosmeticDef[] {
  return COSMETICS.filter((c) => c.slot === slot).sort(
    (a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0),
  );
}
