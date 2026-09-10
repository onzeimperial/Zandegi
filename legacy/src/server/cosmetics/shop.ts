import { db } from "@/lib/db";
import { notFound, badRequest, HttpError } from "@/lib/errors";
import { spendCoins } from "@/server/economy/coins";
import { COSMETIC_BY_KEY } from "./definitions";

export interface PurchaseResult {
  key: string;
  name: string;
  price: number;
  coinBalance: number;
}

/**
 * Buy a cosmetic. The balance check, the debit and the inventory row all
 * commit together, so a failed grant can never silently take coins.
 */
export async function purchaseCosmetic(input: {
  userId: string;
  itemKey: string;
}): Promise<PurchaseResult> {
  const def = COSMETIC_BY_KEY.get(input.itemKey);
  if (!def) throw notFound("Cosmetic");

  const already = await db.userCosmetic.findUnique({
    where: { userId_itemKey: { userId: input.userId, itemKey: input.itemKey } },
  });
  if (already) throw new HttpError(409, "already_owned", `You already own "${def.name}"`);

  // Checked before price, so an achievement-gated item reports why it is
  // locked rather than claiming it is drop-only.
  if (def.unlockAchievementKey) {
    throw new HttpError(
      403,
      "locked",
      `"${def.name}" is earned by unlocking an achievement, not bought`,
    );
  }

  if (def.price == null) {
    throw badRequest(`"${def.name}" can't be bought — it only drops from completing goals`);
  }

  const price = def.price;
  const balance = await db.$transaction(async (tx) => {
    const change = await spendCoins(
      {
        userId: input.userId,
        amount: price,
        source: "purchase",
        meta: { itemKey: def.key, name: def.name },
      },
      tx,
    );

    await tx.userCosmetic.create({
      data: { userId: input.userId, itemKey: def.key, source: "purchase" },
    });

    return change.balance;
  });

  return { key: def.key, name: def.name, price, coinBalance: balance };
}
