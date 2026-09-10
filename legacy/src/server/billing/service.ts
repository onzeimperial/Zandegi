import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { TRIAL_DAYS } from "@/lib/constants";
import {
  isPro,
  limitsFor,
  trialDaysLeft,
  canStartTrial,
  trialEndDate,
  effectiveStatus,
  type SubscriptionState,
} from "./plans";

/** Read the subscription, creating a free row on first access. */
export async function getSubscription(userId: string) {
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.subscription.create({ data: { userId, plan: "free", status: "none" } });
}

export interface Entitlements {
  plan: string;
  status: string;
  isPro: boolean;
  trialDaysLeft: number | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  canStartTrial: boolean;
  limits: {
    activeGoals: number;
    coachMessagesPerDay: number;
    replansPerGoal: number;
    monthlyStreakFreezes: number;
  };
}

/** Everything the UI and the gates need, in one call. */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const sub = await getSubscription(userId);
  const state: SubscriptionState = {
    plan: sub.plan as SubscriptionState["plan"],
    status: sub.status as SubscriptionState["status"],
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
  };

  const status = effectiveStatus(state);
  // Persist a lapse the first time we notice it, so reporting stays honest.
  if (status === "expired" && sub.status !== "expired") {
    await db.subscription.update({
      where: { userId },
      data: { status: "expired", plan: "free" },
    });
  }

  const pro = isPro(state);
  const limits = limitsFor(state);

  return {
    plan: pro ? "pro" : "free",
    status,
    isPro: pro,
    trialDaysLeft: trialDaysLeft(state),
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    canStartTrial: canStartTrial(state),
    limits: {
      activeGoals: limits.activeGoals,
      coachMessagesPerDay: limits.coachMessagesPerDay,
      replansPerGoal: limits.replansPerGoal,
      monthlyStreakFreezes: limits.monthlyStreakFreezes,
    },
  };
}

/** Start the one-per-account free trial. No card, nothing charged. */
export async function startTrial(userId: string) {
  const sub = await getSubscription(userId);
  const state: SubscriptionState = {
    plan: sub.plan as SubscriptionState["plan"],
    status: sub.status as SubscriptionState["status"],
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
  };

  if (!canStartTrial(state)) {
    throw new HttpError(
      409,
      "trial_unavailable",
      sub.status === "trialing"
        ? "Your trial is already running"
        : "You've already used your free trial",
    );
  }

  const now = new Date();
  return db.subscription.update({
    where: { userId },
    data: {
      plan: "pro",
      status: "trialing",
      trialStartedAt: now,
      trialEndsAt: trialEndDate(now),
    },
  });
}

/**
 * Cancel. Access continues to the end of the current period (or trial), which
 * is the behaviour people expect and avoids feeling punitive.
 */
export async function cancelSubscription(userId: string) {
  const sub = await getSubscription(userId);
  if (sub.status === "none" || sub.status === "expired") {
    throw new HttpError(409, "nothing_to_cancel", "You don't have an active subscription");
  }

  return db.subscription.update({
    where: { userId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      // A cancelled trial keeps access until the trial would have ended.
      currentPeriodEnd: sub.currentPeriodEnd ?? sub.trialEndsAt,
    },
  });
}

/** Throw unless the account has Pro. Used to gate Pro-only endpoints. */
export async function requirePro(userId: string, feature = "This feature") {
  const ent = await getEntitlements(userId);
  if (!ent.isPro) {
    throw new HttpError(
      402,
      "upgrade_required",
      `${feature} is part of Zandegi Pro. Start your ${TRIAL_DAYS}-day free trial to unlock it.`,
    );
  }
  return ent;
}

/** Enforce the free-plan cap on simultaneously active goals. */
export async function assertCanCreateGoal(userId: string) {
  const ent = await getEntitlements(userId);
  if (ent.limits.activeGoals === Infinity) return ent;

  const active = await db.goal.count({ where: { userId, status: "active" } });
  if (active >= ent.limits.activeGoals) {
    throw new HttpError(
      402,
      "goal_limit_reached",
      `Free accounts can track ${ent.limits.activeGoals} goals at once. Start your free trial for unlimited goals, or archive a goal first.`,
    );
  }
  return ent;
}
