import { db } from "@/lib/db";
import { HttpError, notFound } from "@/lib/errors";
import { startOfDay, daysBetween } from "@/lib/utils";
import { spendCoins } from "@/server/economy/coins";
import { getEntitlements } from "@/server/billing/service";

/**
 * Streak freezes. The `freezes` column existed on Streak from the start but
 * nothing ever set or spent it — this makes it real.
 *
 * A freeze is consumed automatically when a day is missed, protecting the
 * streak. Free accounts can hold one; Pro accounts up to four.
 */

export const FREEZE_PRICE = 350;

export async function getStreakState(userId: string) {
  const [streak, ent] = await Promise.all([
    db.streak.findUnique({ where: { userId } }),
    getEntitlements(userId),
  ]);

  const current = streak?.current ?? 0;
  const freezes = streak?.freezes ?? 0;
  const max = ent.limits.monthlyStreakFreezes;

  return {
    current,
    longest: streak?.longest ?? 0,
    lastActiveDate: streak?.lastActiveDate ?? null,
    freezes,
    maxFreezes: max,
    canBuy: freezes < max,
    price: FREEZE_PRICE,
    atRisk: isAtRisk(streak?.lastActiveDate ?? null),
  };
}

/** True when the user has not been active today and has a streak to lose. */
function isAtRisk(lastActive: Date | null): boolean {
  if (!lastActive) return false;
  return daysBetween(lastActive, startOfDay()) >= 1;
}

export async function buyStreakFreeze(userId: string) {
  const state = await getStreakState(userId);
  if (!state.canBuy) {
    throw new HttpError(
      409,
      "freeze_limit",
      `You can hold ${state.maxFreezes} streak freeze${state.maxFreezes === 1 ? "" : "s"} at a time.`,
    );
  }

  await spendCoins({
    userId,
    amount: FREEZE_PRICE,
    source: "purchase",
    meta: { item: "streak_freeze" },
  });

  const streak = await db.streak.upsert({
    where: { userId },
    create: { userId, current: 0, longest: 0, freezes: 1 },
    update: { freezes: { increment: 1 } },
  });

  return { freezes: streak.freezes };
}

/**
 * Apply a freeze if a day was missed. Called before the streak is evaluated
 * so a protected gap does not reset the count.
 *
 * Returns whether a freeze was consumed.
 */
export async function applyFreezeIfMissed(userId: string, now: Date = new Date()) {
  const streak = await db.streak.findUnique({ where: { userId } });
  if (!streak?.lastActiveDate) return { used: false, freezes: streak?.freezes ?? 0 };

  const gap = daysBetween(streak.lastActiveDate, startOfDay(now));
  // A gap of exactly 1 is a normal consecutive day; 2+ means a day was missed.
  if (gap < 2) return { used: false, freezes: streak.freezes };
  if (streak.freezes <= 0) return { used: false, freezes: 0 };

  // Consume one freeze and move the marker forward so the streak survives.
  const updated = await db.streak.update({
    where: { userId },
    data: {
      freezes: { decrement: 1 },
      lastActiveDate: startOfDay(new Date(now.getTime() - 86_400_000)),
    },
  });

  await db.notification.create({
    data: {
      userId,
      type: "achievement",
      title: "Streak freeze used",
      body: `You missed a day, but a freeze protected your ${streak.current}-day streak.`,
      href: "/dashboard",
    },
  });

  return { used: true, freezes: updated.freezes };
}

/**
 * Pro-only: restore a streak broken within the last two days.
 * Duolingo charges for this; here it is a Pro entitlement.
 */
export async function repairStreak(userId: string) {
  const ent = await getEntitlements(userId);
  if (!ent.isPro) {
    throw new HttpError(
      402,
      "upgrade_required",
      "Streak repair is part of Zandegi Pro. Start your free trial to unlock it.",
    );
  }

  const streak = await db.streak.findUnique({ where: { userId } });
  if (!streak) throw notFound("Streak");
  if (streak.current > 0) {
    throw new HttpError(409, "not_broken", "Your streak isn't broken.");
  }
  if (streak.longest === 0) {
    throw new HttpError(409, "nothing_to_repair", "There's no streak to restore yet.");
  }
  if (!streak.lastActiveDate || daysBetween(streak.lastActiveDate, startOfDay()) > 2) {
    throw new HttpError(
      409,
      "too_late",
      "Streaks can only be repaired within two days of breaking.",
    );
  }

  const restored = await db.streak.update({
    where: { userId },
    data: { current: streak.longest, lastActiveDate: startOfDay() },
  });

  return { current: restored.current };
}
