/**
 * Pure drop-roll maths. No IO — unit tested (test/drops.test.ts).
 *
 * Rolls are seeded on the user + goal, so a given completion cannot be
 * rerolled by refreshing: the rarity tier is fixed by the seed. The item
 * chosen within that tier still depends on what the user already owns, since
 * drops never hand out duplicates.
 */

import { RARITIES, type Rarity } from "@/lib/constants";

export interface DropCandidate {
  key: string;
  rarity: Rarity;
  /** Items granted to everyone are never dropped. */
  isDefault?: boolean;
  /** Achievement-gated items are earned that way, not dropped. */
  unlockAchievementKey?: string;
}

export interface DropResult {
  key: string;
  rarity: Rarity;
  /** How many tiers above the guaranteed floor this roll landed. */
  upgradedBy: number;
}

/** FNV-1a — small, fast, and stable across runs. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — a compact seeded PRNG. */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UPGRADE_TWO_TIERS = 0.05;
const UPGRADE_ONE_TIER = 0.2;

/**
 * The rarity actually rolled: the floor guaranteed by the goal's size, with
 * a small chance of landing one or two tiers above it.
 */
export function rollRarity(floor: Rarity, rng: () => number): Rarity {
  const floorRank = RARITIES.indexOf(floor);
  const r = rng();
  const bump = r < UPGRADE_TWO_TIERS ? 2 : r < UPGRADE_ONE_TIER ? 1 : 0;
  const rank = Math.min(RARITIES.length - 1, floorRank + bump);
  return RARITIES[rank]!;
}

/**
 * Pick an unowned cosmetic at the rolled rarity. Falls back down the tiers —
 * never up — so high rarities stay exclusive to genuinely big goals.
 * Returns null when the user already owns everything at or below the roll.
 */
export function rollDrop(params: {
  seed: string;
  floor: Rarity;
  pool: DropCandidate[];
  ownedKeys: Iterable<string>;
}): DropResult | null {
  const rng = seededRandom(params.seed);
  const rolled = rollRarity(params.floor, rng);
  const owned = new Set(params.ownedKeys);
  const floorRank = RARITIES.indexOf(params.floor);

  const eligible = params.pool.filter(
    (c) => !c.isDefault && !c.unlockAchievementKey && !owned.has(c.key),
  );

  for (let rank = RARITIES.indexOf(rolled); rank >= 0; rank--) {
    const tier = RARITIES[rank]!;
    const candidates = eligible
      .filter((c) => c.rarity === tier)
      .sort((a, b) => a.key.localeCompare(b.key)); // stable ordering for a stable seed
    if (!candidates.length) continue;

    const pick = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0]!;
    return { key: pick.key, rarity: tier, upgradedBy: Math.max(0, rank - floorRank) };
  }

  return null;
}

/** Milestones drop rarely, and one tier below the goal's floor. */
export const MILESTONE_DROP_CHANCE = 0.25;

export function shouldDropOnMilestone(seed: string): boolean {
  return seededRandom(`milestone:${seed}`)() < MILESTONE_DROP_CHANCE;
}

export function tierBelow(rarity: Rarity): Rarity {
  const rank = Math.max(0, RARITIES.indexOf(rarity) - 1);
  return RARITIES[rank]!;
}
