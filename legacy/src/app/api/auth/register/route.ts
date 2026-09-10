import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { route, ok, fail, assertSameOrigin, rateLimit, tooMany } from "@/lib/api";
import { parseBody, registerSchema } from "@/lib/validation";
import { seedAchievementsIfNeeded } from "@/server/achievements/seed-runtime";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = rateLimit(`register:${ip}`, 8, 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfter);

  const body = await parseBody(req, registerSchema);

  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) return fail(409, "email_taken", "An account with that email already exists");

  const passwordHash = await hashPassword(body.password);

  const user = await db.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
      profile: {
        create: {
          displayName: body.name,
          dailyMinutes: body.dailyMinutes ?? 45,
          weeklyDays: body.weeklyDays ?? 5,
          timezone: body.timezone ?? "UTC",
        },
      },
      streak: { create: {} },
    },
    select: { id: true, email: true, name: true },
  });

  await seedAchievementsIfNeeded();

  return ok({ user }, { status: 201 });
});
