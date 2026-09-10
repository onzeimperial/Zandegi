/**
 * Plan definitions and entitlement logic. Pure — no IO, unit tested
 * (test/billing.test.ts).
 *
 * There is no payment provider wired up. A trial is started locally and
 * simply expires; nothing here charges anyone. `isPro()` is the single place
 * that decides whether someone has Pro access, so swapping in real billing
 * later means changing how `status` is set, not how it is read.
 */

import { TRIAL_DAYS, type Plan, type SubscriptionStatus } from "@/lib/constants";

export interface SubscriptionState {
  plan: Plan;
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
}

export interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
}

export const PLAN_FEATURES: PlanFeature[] = [
  { label: "Goals you can track at once", free: "3", pro: "Unlimited" },
  { label: "Full 1,000+ goal catalogue", free: true, pro: true },
  { label: "Avatar, coins, drops and leagues", free: true, pro: true },
  { label: "AI coaching messages per day", free: "5", pro: "Unlimited" },
  { label: "AI goal re-planning", free: "Once per goal", pro: "Unlimited" },
  { label: "Advanced analytics and trends", free: false, pro: true },
  { label: "Streak repair after a missed day", free: false, pro: true },
  { label: "Monthly streak freezes", free: "1", pro: "4" },
  { label: "Pro-only cosmetics", free: false, pro: true },
  { label: "Data export", free: false, pro: true },
];

/** Hard limits applied to free accounts. */
export const FREE_LIMITS = {
  activeGoals: 3,
  coachMessagesPerDay: 5,
  replansPerGoal: 1,
  monthlyStreakFreezes: 1,
} as const;

export const PRO_LIMITS = {
  activeGoals: Infinity,
  coachMessagesPerDay: Infinity,
  replansPerGoal: Infinity,
  monthlyStreakFreezes: 4,
} as const;

/**
 * Whether the account currently has Pro access. Trialing counts as Pro —
 * that is the point of a trial — but only until it expires.
 */
export function isPro(sub: SubscriptionState | null | undefined, now: Date = new Date()): boolean {
  if (!sub) return false;
  if (sub.status === "active") {
    // An active subscription with a period end in the past has lapsed.
    return !sub.currentPeriodEnd || sub.currentPeriodEnd > now;
  }
  if (sub.status === "trialing") {
    return Boolean(sub.trialEndsAt && sub.trialEndsAt > now);
  }
  // "cancelled" keeps access until the paid period actually ends.
  if (sub.status === "cancelled") {
    return Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd > now);
  }
  return false;
}

export function limitsFor(sub: SubscriptionState | null | undefined, now: Date = new Date()) {
  return isPro(sub, now) ? PRO_LIMITS : FREE_LIMITS;
}

/** Whole days left in a trial, or null when not trialing. */
export function trialDaysLeft(
  sub: SubscriptionState | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!sub || sub.status !== "trialing" || !sub.trialEndsAt) return null;
  const ms = sub.trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/** A trial can only ever be started once per account. */
export function canStartTrial(sub: SubscriptionState | null | undefined): boolean {
  if (!sub) return true;
  return sub.status === "none";
}

export function trialEndDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 86_400_000);
}

/** Status shown in the UI, resolving expiry that hasn't been written yet. */
export function effectiveStatus(
  sub: SubscriptionState | null | undefined,
  now: Date = new Date(),
): SubscriptionStatus {
  if (!sub) return "none";
  if (sub.status === "trialing" && sub.trialEndsAt && sub.trialEndsAt <= now) return "expired";
  if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) return "expired";
  if (sub.status === "cancelled" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) return "expired";
  return sub.status;
}
