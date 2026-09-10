import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getCharacterProfile } from "@/server/character/service";
import { seedAchievementsIfNeeded } from "@/server/achievements/seed-runtime";

export const GET = route(async () => {
  const user = await requireUser();
  await seedAchievementsIfNeeded();
  return ok(await getCharacterProfile(user.id));
});
