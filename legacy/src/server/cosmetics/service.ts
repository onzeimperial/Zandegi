import { db } from "@/lib/db";
import { notFound, badRequest, HttpError } from "@/lib/errors";
import {
  COSMETIC_SLOTS,
  RARITY_LABELS,
  type CosmeticSlot,
  type CosmeticSource,
  type Rarity,
} from "@/lib/constants";
import { COSMETICS, COSMETIC_BY_KEY, DEFAULT_COSMETIC_KEYS, type CosmeticDef } from "./definitions";
import { goalScaleScore, rarityFloorForScale } from "@/server/economy/rates";
import { rollDrop, shouldDropOnMilestone, tierBelow, type DropCandidate } from "./drops";
import { logActivity } from "@/server/activity/service";

const SLOT_COLUMN: Record<CosmeticSlot, string> = {
  base: "avatarBase",
  face: "avatarFace",
  hair: "avatarHair",
  outfit: "avatarOutfit",
  accessory: "avatarAccessory",
  aura: "avatarAura",
  frame: "avatarFrame",
};

/** Slots that may legitimately be left empty. */
const OPTIONAL_SLOTS: CosmeticSlot[] = ["accessory", "aura"];

export interface WardrobeItem extends CosmeticDef {
  owned: boolean;
  equipped: boolean;
  /** Set when the item is gated behind an achievement the user lacks. */
  lockedBy?: string;
  isNew: boolean;
}

/**
 * Everything the avatar creator needs: the full catalogue annotated with what
 * this user owns, what they have equipped, and what is still locked.
 */
export async function getWardrobe(userId: string) {
  const [profile, owned, unlockedAchievements] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.userCosmetic.findMany({ where: { userId } }),
    db.userAchievement.findMany({
      where: { userId, unlockedAt: { not: null } },
      select: { achievementKey: true },
    }),
  ]);
  if (!profile) throw notFound("Profile");

  const ownedByKey = new Map(owned.map((o) => [o.itemKey, o]));
  const unlocked = new Set(unlockedAchievements.map((a) => a.achievementKey));

  const equippedBySlot: Record<string, string> = {
    base: profile.avatarBase,
    face: profile.avatarFace,
    hair: profile.avatarHair,
    outfit: profile.avatarOutfit,
    accessory: profile.avatarAccessory,
    aura: profile.avatarAura,
    frame: profile.avatarFrame,
  };

  const items: WardrobeItem[] = COSMETICS.map((def) => {
    const own = ownedByKey.get(def.key);
    const gated =
      def.unlockAchievementKey && !unlocked.has(def.unlockAchievementKey)
        ? def.unlockAchievementKey
        : undefined;
    return {
      ...def,
      owned: Boolean(own),
      equipped: equippedBySlot[def.slot] === def.key,
      ...(gated ? { lockedBy: gated } : {}),
      isNew: Boolean(own && !own.seenAt),
    };
  });

  return {
    items,
    coins: profile.coins,
    avatar: {
      base: profile.avatarBase,
      face: profile.avatarFace,
      hair: profile.avatarHair,
      outfit: profile.avatarOutfit,
      accessory: profile.avatarAccessory,
      aura: profile.avatarAura,
      frame: profile.avatarFrame,
      skinTone: profile.avatarSkinTone,
      hairColor: profile.avatarHairColor,
      color: profile.avatarColor,
    },
  };
}

/** Give a user an item. Idempotent — re-granting is a no-op, not an error. */
export async function grantCosmetic(input: {
  userId: string;
  itemKey: string;
  source: CosmeticSource;
  goalId?: string | null;
}) {
  if (!COSMETIC_BY_KEY.has(input.itemKey)) {
    throw badRequest(`Unknown cosmetic "${input.itemKey}"`);
  }
  const existing = await db.userCosmetic.findUnique({
    where: { userId_itemKey: { userId: input.userId, itemKey: input.itemKey } },
  });
  if (existing) return { granted: false, item: COSMETIC_BY_KEY.get(input.itemKey)! };

  await db.userCosmetic.create({
    data: {
      userId: input.userId,
      itemKey: input.itemKey,
      source: input.source,
      goalId: input.goalId ?? null,
    },
  });
  return { granted: true, item: COSMETIC_BY_KEY.get(input.itemKey)! };
}

/** Grant the starter set. Called on registration and by seed. */
export async function grantDefaultCosmetics(userId: string) {
  for (const key of DEFAULT_COSMETIC_KEYS) {
    await grantCosmetic({ userId, itemKey: key, source: "default" });
  }
}

/**
 * Equip an item into its slot. Rejects items the user does not own, and
 * items still gated behind an achievement.
 */
export async function equipCosmetic(input: {
  userId: string;
  slot: CosmeticSlot;
  itemKey: string;
}) {
  if (!COSMETIC_SLOTS.includes(input.slot)) throw badRequest("Unknown slot");

  if (input.itemKey === "none") {
    if (!OPTIONAL_SLOTS.includes(input.slot)) {
      throw badRequest(`The ${input.slot} slot cannot be left empty`);
    }
    return updateSlot(input.userId, input.slot, "none");
  }

  const def = COSMETIC_BY_KEY.get(input.itemKey);
  if (!def) throw notFound("Cosmetic");
  if (def.slot !== input.slot) {
    throw badRequest(`"${def.name}" is not a ${input.slot} item`);
  }

  const owned = await db.userCosmetic.findUnique({
    where: { userId_itemKey: { userId: input.userId, itemKey: input.itemKey } },
  });
  if (!owned) throw new HttpError(403, "not_owned", `You do not own "${def.name}"`);

  // Mark as seen once it has actually been used.
  if (!owned.seenAt) {
    await db.userCosmetic.update({ where: { id: owned.id }, data: { seenAt: new Date() } });
  }

  return updateSlot(input.userId, input.slot, input.itemKey);
}

/** Update the palette colours, which are free-form and not owned items. */
export async function updateAvatarPalette(input: {
  userId: string;
  skinTone?: string;
  hairColor?: string;
  color?: string;
}) {
  return db.profile.update({
    where: { userId: input.userId },
    data: {
      ...(input.skinTone ? { avatarSkinTone: input.skinTone } : {}),
      ...(input.hairColor ? { avatarHairColor: input.hairColor } : {}),
      ...(input.color ? { avatarColor: input.color } : {}),
    },
  });
}

// ── Drops ──────────────────────────────────────────────────

const DROP_POOL: DropCandidate[] = COSMETICS.map((c) => ({
  key: c.key,
  rarity: c.rarity,
  ...(c.isDefault ? { isDefault: true } : {}),
  ...(c.unlockAchievementKey ? { unlockAchievementKey: c.unlockAchievementKey } : {}),
}));

export interface AwardedDrop {
  key: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  /** Tiers above the goal's guaranteed floor — drives the reveal animation. */
  upgradedBy: number;
}

async function award(
  userId: string,
  goalId: string,
  seed: string,
  floor: Rarity,
): Promise<AwardedDrop | null> {
  const owned = await db.userCosmetic.findMany({
    where: { userId },
    select: { itemKey: true },
  });

  const result = rollDrop({
    seed,
    floor,
    pool: DROP_POOL,
    ownedKeys: owned.map((o) => o.itemKey),
  });
  if (!result) return null;

  const def = COSMETIC_BY_KEY.get(result.key);
  if (!def) return null;

  const { granted } = await grantCosmetic({
    userId,
    itemKey: result.key,
    source: "drop",
    goalId,
  });
  if (!granted) return null;

  await db.notification.create({
    data: {
      userId,
      type: "achievement",
      title: `${RARITY_LABELS[def.rarity]} drop: ${def.name}`,
      body: def.description,
      href: "/avatar",
      meta: JSON.stringify({ kind: "cosmetic_drop", key: def.key, rarity: def.rarity }),
    },
  });

  await logActivity({
    userId,
    kind: "cosmetic_drop",
    title: `${RARITY_LABELS[def.rarity]} drop: ${def.name}`,
    rarity: def.rarity,
  });

  return {
    key: def.key,
    name: def.name,
    description: def.description,
    slot: def.slot,
    rarity: def.rarity,
    upgradedBy: result.upgradedBy,
  };
}

/**
 * Guaranteed drop when a goal is completed. The goal's size sets the rarity
 * floor, so finishing something long and hard rewards better.
 */
export async function awardGoalCompletionDrop(input: { userId: string; goalId: string }) {
  const goal = await db.goal.findUnique({ where: { id: input.goalId } });
  if (!goal) return null;

  const scale = goalScaleScore({
    difficulty: goal.difficulty,
    targetLevel: goal.targetLevel,
    timelineWeeks: goal.timelineWeeks,
  });

  return award(input.userId, goal.id, `goal:${input.userId}:${goal.id}`, rarityFloorForScale(scale));
}

/** Chance-based drop when a milestone completes, one tier below the goal floor. */
export async function awardMilestoneDrop(input: {
  userId: string;
  goalId: string;
  milestoneId: string;
}) {
  const seed = `${input.userId}:${input.milestoneId}`;
  if (!shouldDropOnMilestone(seed)) return null;

  const goal = await db.goal.findUnique({ where: { id: input.goalId } });
  if (!goal) return null;

  const scale = goalScaleScore({
    difficulty: goal.difficulty,
    targetLevel: goal.targetLevel,
    timelineWeeks: goal.timelineWeeks,
  });

  return award(input.userId, goal.id, `ms:${seed}`, tierBelow(rarityFloorForScale(scale)));
}

async function updateSlot(userId: string, slot: CosmeticSlot, itemKey: string) {
  const column = SLOT_COLUMN[slot];
  return db.profile.update({
    where: { userId },
    data: { [column]: itemKey },
  });
}
