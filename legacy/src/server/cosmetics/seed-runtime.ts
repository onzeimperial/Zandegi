import { db } from "@/lib/db";
import { COSMETICS, DEFAULT_COSMETIC_KEYS } from "./definitions";

let ensured = false;

/**
 * Idempotently mirror the cosmetic catalogue into the DB. Mirrors
 * seedAchievementsIfNeeded — cheap enough to call from request paths.
 */
export async function seedCosmeticsIfNeeded() {
  if (ensured) return;
  const count = await db.cosmeticItem.count();
  if (count >= COSMETICS.length) {
    ensured = true;
    return;
  }
  for (const c of COSMETICS) {
    const data = {
      name: c.name,
      description: c.description,
      slot: c.slot,
      rarity: c.rarity,
      price: c.price,
      unlockAchievementKey: c.unlockAchievementKey ?? null,
      isDefault: c.isDefault ?? false,
      secret: c.secret ?? false,
      sortIndex: c.sortIndex ?? 0,
    };
    await db.cosmeticItem.upsert({
      where: { key: c.key },
      create: { key: c.key, ...data },
      update: data,
    });
  }
  ensured = true;
}

/**
 * Make sure a user owns the starter set. Runs on first wardrobe load so
 * accounts created before cosmetics existed get their defaults too.
 */
export async function ensureDefaultCosmetics(userId: string) {
  const owned = await db.userCosmetic.findMany({
    where: { userId, itemKey: { in: DEFAULT_COSMETIC_KEYS } },
    select: { itemKey: true },
  });
  if (owned.length === DEFAULT_COSMETIC_KEYS.length) return;

  const have = new Set(owned.map((o) => o.itemKey));
  const missing = DEFAULT_COSMETIC_KEYS.filter((k) => !have.has(k));
  if (!missing.length) return;

  await db.userCosmetic.createMany({
    data: missing.map((itemKey) => ({ userId, itemKey, source: "default" })),
  });
}
