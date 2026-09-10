import { describe, it, expect } from "vitest";
import {
  isPro,
  limitsFor,
  trialDaysLeft,
  canStartTrial,
  trialEndDate,
  effectiveStatus,
  PLAN_FEATURES,
  FREE_LIMITS,
  PRO_LIMITS,
  type SubscriptionState,
} from "@/server/billing/plans";
import { TRIAL_DAYS } from "@/lib/constants";

const NOW = new Date("2026-06-15T12:00:00Z");
const future = (days: number) => new Date(NOW.getTime() + days * 86_400_000);
const past = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("isPro", () => {
  it("is false with no subscription", () => {
    expect(isPro(null, NOW)).toBe(false);
    expect(isPro(undefined, NOW)).toBe(false);
  });

  it("is false on a fresh free account", () => {
    expect(isPro({ plan: "free", status: "none" }, NOW)).toBe(false);
  });

  it("is true during a live trial", () => {
    expect(isPro({ plan: "pro", status: "trialing", trialEndsAt: future(3) }, NOW)).toBe(true);
  });

  it("is false once the trial has passed", () => {
    expect(isPro({ plan: "pro", status: "trialing", trialEndsAt: past(1) }, NOW)).toBe(false);
  });

  it("is false for a trialing row with no end date", () => {
    expect(isPro({ plan: "pro", status: "trialing" }, NOW)).toBe(false);
  });

  it("is true while active", () => {
    expect(isPro({ plan: "pro", status: "active", currentPeriodEnd: future(20) }, NOW)).toBe(true);
  });

  it("is false when an active period has lapsed", () => {
    expect(isPro({ plan: "pro", status: "active", currentPeriodEnd: past(2) }, NOW)).toBe(false);
  });

  it("keeps access after cancelling until the period ends", () => {
    expect(isPro({ plan: "pro", status: "cancelled", currentPeriodEnd: future(5) }, NOW)).toBe(true);
    expect(isPro({ plan: "pro", status: "cancelled", currentPeriodEnd: past(5) }, NOW)).toBe(false);
  });

  it("is false once expired", () => {
    expect(isPro({ plan: "free", status: "expired" }, NOW)).toBe(false);
  });
});

describe("limits", () => {
  it("caps free accounts and uncaps pro", () => {
    expect(limitsFor(null, NOW).activeGoals).toBe(FREE_LIMITS.activeGoals);
    expect(limitsFor({ plan: "pro", status: "trialing", trialEndsAt: future(1) }, NOW).activeGoals).toBe(
      PRO_LIMITS.activeGoals,
    );
  });

  it("gives pro strictly more than free everywhere it differs", () => {
    expect(PRO_LIMITS.activeGoals).toBeGreaterThan(FREE_LIMITS.activeGoals);
    expect(PRO_LIMITS.coachMessagesPerDay).toBeGreaterThan(FREE_LIMITS.coachMessagesPerDay);
    expect(PRO_LIMITS.monthlyStreakFreezes).toBeGreaterThan(FREE_LIMITS.monthlyStreakFreezes);
  });
});

describe("trialDaysLeft", () => {
  it("is null when not trialing", () => {
    expect(trialDaysLeft({ plan: "free", status: "none" }, NOW)).toBeNull();
    expect(trialDaysLeft({ plan: "pro", status: "active" }, NOW)).toBeNull();
  });

  it("counts remaining days, rounding up", () => {
    expect(trialDaysLeft({ plan: "pro", status: "trialing", trialEndsAt: future(3) }, NOW)).toBe(3);
  });

  it("is zero once passed rather than negative", () => {
    expect(trialDaysLeft({ plan: "pro", status: "trialing", trialEndsAt: past(2) }, NOW)).toBe(0);
  });
});

describe("canStartTrial", () => {
  it("allows a brand new account", () => {
    expect(canStartTrial(null)).toBe(true);
    expect(canStartTrial({ plan: "free", status: "none" })).toBe(true);
  });

  it("blocks a second trial in every other state", () => {
    for (const status of ["trialing", "active", "cancelled", "expired"] as const) {
      expect(canStartTrial({ plan: "pro", status }), status).toBe(false);
    }
  });
});

describe("trialEndDate", () => {
  it("is exactly the configured trial length away", () => {
    const end = trialEndDate(NOW);
    expect(Math.round((end.getTime() - NOW.getTime()) / 86_400_000)).toBe(TRIAL_DAYS);
  });
});

describe("effectiveStatus", () => {
  it("reports expiry before it has been written to the row", () => {
    const stale: SubscriptionState = { plan: "pro", status: "trialing", trialEndsAt: past(1) };
    expect(effectiveStatus(stale, NOW)).toBe("expired");
  });

  it("leaves live states alone", () => {
    expect(effectiveStatus({ plan: "pro", status: "trialing", trialEndsAt: future(1) }, NOW)).toBe("trialing");
    expect(effectiveStatus(null, NOW)).toBe("none");
  });
});

describe("plan comparison table", () => {
  it("never advertises pro as worse than free", () => {
    for (const f of PLAN_FEATURES) {
      if (f.free === true) {
        expect(f.pro, `"${f.label}" is on free but not pro`).not.toBe(false);
      }
    }
  });

  it("has a non-empty label for every row", () => {
    for (const f of PLAN_FEATURES) expect(f.label.length).toBeGreaterThan(0);
  });
});
