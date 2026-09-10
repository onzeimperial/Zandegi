import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  return ok({ profile });
});

const patchSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(400).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().max(64).optional(),
  dailyMinutes: z.coerce.number().int().min(5).max(600).optional(),
  weeklyDays: z.coerce.number().int().min(1).max(7).optional(),
  publicProfile: z.boolean().optional(),
  showXp: z.boolean().optional(),
  showGoals: z.boolean().optional(),
  showStreak: z.boolean().optional(),
  allowChallenges: z.boolean().optional(),
  markOnboarded: z.boolean().optional(),
});

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await parseBody(req, patchSchema);
  const { markOnboarded, ...rest } = body;

  const profile = await db.profile.update({
    where: { userId: user.id },
    data: {
      ...rest,
      ...(markOnboarded ? { onboardedAt: new Date() } : {}),
    },
  });
  return ok({ profile });
});
