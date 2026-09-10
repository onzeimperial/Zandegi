import { z } from "zod";
import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validation";
import { COSMETIC_SLOTS } from "@/lib/constants";
import { getWardrobe, equipCosmetic, updateAvatarPalette } from "@/server/cosmetics/service";
import { seedCosmeticsIfNeeded, ensureDefaultCosmetics } from "@/server/cosmetics/seed-runtime";

export const GET = route(async () => {
  const user = await requireUser();
  await seedCosmeticsIfNeeded();
  await ensureDefaultCosmetics(user.id);
  return ok(await getWardrobe(user.id));
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour");

const patchSchema = z.object({
  equip: z
    .array(
      z.object({
        slot: z.enum(COSMETIC_SLOTS),
        itemKey: z.string().min(1).max(64),
      }),
    )
    .max(COSMETIC_SLOTS.length)
    .optional(),
  skinTone: hex.optional(),
  hairColor: hex.optional(),
  color: hex.optional(),
});

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await parseBody(req, patchSchema);

  for (const change of body.equip ?? []) {
    await equipCosmetic({ userId: user.id, slot: change.slot, itemKey: change.itemKey });
  }

  if (body.skinTone || body.hairColor || body.color) {
    await updateAvatarPalette({
      userId: user.id,
      ...(body.skinTone ? { skinTone: body.skinTone } : {}),
      ...(body.hairColor ? { hairColor: body.hairColor } : {}),
      ...(body.color ? { color: body.color } : {}),
    });
  }

  return ok(await getWardrobe(user.id));
});
