"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Sparkles, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";

interface Feature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
}

interface Entitlements {
  plan: string;
  status: string;
  isPro: boolean;
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
  canStartTrial: boolean;
}

interface BillingResponse {
  entitlements: Entitlements;
  features: Feature[];
  trialDays: number;
}

export default function ProPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<BillingResponse>("/api/billing"),
  });

  if (isLoading || !data) return <Spinner className="py-24" />;
  const e = data.entitlements;

  async function act(action: "start_trial" | "cancel", success: string) {
    setBusy(true);
    try {
      await api.post("/api/billing", { action });
      toast.push({ kind: "success", title: success });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.push({
        kind: "error",
        title: err instanceof ApiClientError ? err.message : "Something went wrong",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="text-center">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 text-brand" /> Zandegi Pro
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {e.isPro ? "You're on Pro" : "Go further with Pro"}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          {e.isPro
            ? "Unlimited goals, unlimited coaching, and everything else unlocked."
            : `Unlimited goals and AI coaching, advanced analytics and streak protection. Try it free for ${data.trialDays} days — no card needed.`}
        </p>
      </header>

      {/* ── Status ─────────────────────────────────────────── */}
      {e.status === "trialing" && e.trialDaysLeft != null ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-brand p-4">
          <div>
            <p className="text-sm font-semibold">
              Free trial — {e.trialDaysLeft} day{e.trialDaysLeft === 1 ? "" : "s"} left
            </p>
            <p className="text-xs text-muted">
              Nothing will be charged. Your account returns to Free when the trial ends.
            </p>
          </div>
          <button onClick={() => act("cancel", "Trial cancelled")} disabled={busy} className="btn-outline">
            End trial
          </button>
        </div>
      ) : e.status === "cancelled" ? (
        <div className="card p-4">
          <p className="text-sm font-semibold">Cancelled</p>
          <p className="text-xs text-muted">You keep Pro access until the current period ends.</p>
        </div>
      ) : e.status === "expired" ? (
        <div className="card p-4">
          <p className="text-sm font-semibold">Your trial has ended</p>
          <p className="text-xs text-muted">You're back on the Free plan. Nothing was charged.</p>
        </div>
      ) : null}

      {/* ── Comparison ─────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-xs font-medium">
          <span>Feature</span>
          <span className="text-center text-muted">Free</span>
          <span className="text-center text-brand">Pro</span>
        </div>
        {data.features.map((f) => (
          <div
            key={f.label}
            className="grid grid-cols-[1fr_80px_80px] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0"
          >
            <span>{f.label}</span>
            <Cell value={f.free} />
            <Cell value={f.pro} highlight />
          </div>
        ))}
      </div>

      {/* ── Action ─────────────────────────────────────────── */}
      {!e.isPro ? (
        <div className="text-center">
          <button
            onClick={() => act("start_trial", "Your free trial has started")}
            disabled={busy || !e.canStartTrial}
            className="btn-primary w-full sm:w-auto"
          >
            {e.canStartTrial
              ? `Start your ${data.trialDays}-day free trial`
              : "Trial already used"}
          </button>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            No card required. Nothing is charged, ever — billing isn't connected yet.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  if (value === true) {
    return (
      <span className="grid place-items-center">
        <Check className={cn("h-4 w-4", highlight ? "text-brand" : "text-success")} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="grid place-items-center">
        <X className="h-4 w-4 text-muted opacity-50" />
      </span>
    );
  }
  return (
    <span className={cn("text-center text-xs font-medium", highlight && "text-brand")}>{value}</span>
  );
}
