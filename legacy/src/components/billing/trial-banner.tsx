"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Entitlements {
  isPro: boolean;
  status: string;
  trialDaysLeft: number | null;
  canStartTrial: boolean;
}

const DISMISS_KEY = "zandegi:trial-banner-dismissed";

/**
 * A single, dismissible prompt. Deliberately not shown on every page load —
 * an upsell that nags is worse than one that waits.
 */
export function TrialBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<{ entitlements: Entitlements }>("/api/billing"),
    staleTime: 60_000,
  });

  if (!data) return null;
  const e = data.entitlements;

  // Trial ending soon always shows — that one is genuinely time-sensitive.
  const endingSoon = e.status === "trialing" && e.trialDaysLeft != null && e.trialDaysLeft <= 3;
  if (!endingSoon && (dismissed || e.isPro || !e.canStartTrial)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private browsing — the banner simply reappears next session.
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-md border border-brand bg-brand-soft px-4 py-2.5">
      <Sparkles className="h-4 w-4 shrink-0 text-brand" />
      <p className="min-w-0 flex-1 text-sm">
        {endingSoon ? (
          <>
            Your Pro trial ends in <strong>{e.trialDaysLeft} day{e.trialDaysLeft === 1 ? "" : "s"}</strong>.
          </>
        ) : (
          <>
            Unlimited goals, unlimited AI coaching and more — <strong>free for 14 days</strong>, no card
            needed.
          </>
        )}
      </p>
      <Link href="/pro" className="btn-primary shrink-0 px-3 py-1.5 text-xs">
        {endingSoon ? "Manage" : "Try Pro"}
      </Link>
      {!endingSoon ? (
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-muted hover:text-fg">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
