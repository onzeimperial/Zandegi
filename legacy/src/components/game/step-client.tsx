"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { RARITIES, type Rarity } from "@/lib/constants";
import { FeedbackBar, type EarnedDrop } from "./feedback-bar";

interface CompleteResult {
  xpAwarded: number;
  drops: { name: string; rarity: Rarity }[];
}

/**
 * Owns the "Mark complete" button and the completion sequence: stage 1 (the
 * press) happens here; the API call fetches the REAL xpAwarded/drops before
 * anything is revealed — the count-up target is never guessed client-side.
 */
export function StepClient({ taskId, goalId }: { taskId: string; goalId: string }) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    if (submitting) return;
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<CompleteResult>(`/api/tasks/${taskId}/complete`, {});
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't complete that — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    // Most completions earn no drop at all — task XP alone has no rarity.
    // When more than one fires (a milestone and a goal completing on the
    // same task), the most significant one drives the bar's colour.
    const topDrop: EarnedDrop | null = result.drops.length
      ? [...result.drops].sort(
          (a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity),
        )[0]!
      : null;

    return (
      <FeedbackBar
        xpAwarded={result.xpAwarded}
        drop={topDrop}
        onContinue={() => router.push(`/path?goalId=${goalId}`)}
      />
    );
  }

  return (
    <div className="border-t border-game-surface-hi p-4">
      {error ? <p className="mb-2 font-game-body text-xs text-game-magenta">{error}</p> : null}
      <button
        onClick={markComplete}
        disabled={submitting}
        className={cn(
          "w-full rounded-md bg-game-cyan py-3 text-center font-game-body text-sm font-semibold text-game-void transition-transform disabled:opacity-70",
          pressed && "animate-g-press",
        )}
      >
        {submitting ? "Completing…" : "Mark complete"}
      </button>
    </div>
  );
}
