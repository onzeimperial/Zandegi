import { z } from "zod";
import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { getWardrobe } from "@/server/cosmetics/service";
import { purchaseCosmetic } from "@/server/cosmetics/shop";
import { seedCosmeticsIfNeeded, ensureDefaultCosmetics } from "@/server/cosmetics/seed-runtime";

export const GET = route(async () => {
  const user = await requireUser();
  await seedCosmeticsIfNeeded();
  await ensureDefaultCosmetics(user.id);

  const wardrobe = await getWardrobe(user.id);
  // The shop only lists what can actually be bought.
  return ok({
    coins: wardrobe.coins,
    avatar: wardrobe.avatar,
    items: wardrobe.items.filter((i) => i.price != null || i.lockedBy || !i.owned),
  });
});

const buySchema = z.object({ itemKey: z.string().min(1).max(64) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { itemKey } = await parseBody(req, buySchema);
  const purchase = await purchaseCosmetic({ userId: user.id, itemKey });
  return ok({ purchase, wardrobe: await getWardrobe(user.id) });
});
