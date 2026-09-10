"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { RARITY_COLORS, type Rarity } from "@/lib/constants";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/** Drop rarities worth a glow. Common/uncommon are the everyday case. */
const GLOW_WORTHY: Rarity[] = ["rare", "epic", "legendary", "mythic"];

export interface EarnedDrop {
  name: string;
  rarity: Rarity;
}

export interface FeedbackBarProps {
  xpAwarded: number;
  /** Real cosmetic drop, if this specific completion earned one. Most don't. */
  drop: EarnedDrop | null;
  onContinue: () => void;
}

type Stage = "sliding" | "counting" | "glow" | "done";

/**
 * Stages 2–6 of the completion sequence. Stage 1 (the button press) happens
 * in the parent before this mounts.
 *
 * Colour: when a real drop was earned, the bar and glow use ITS rarity
 * colour (RARITY_COLORS — the existing 6-tier authored drop system used
 * everywhere else in the app for cosmetics). Most completions earn no drop
 * at all — task XP has no rarity — so the bar defaults to the brand cyan
 * rather than inventing a rarity for a plain XP gain.
 */
export function FeedbackBar({ xpAwarded, drop, onContinue }: FeedbackBarProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [stage, setStage] = useState<Stage>(reducedMotion ? "done" : "sliding");
  const [xpShown, setXpShown] = useState(reducedMotion ? xpAwarded : 0);
  const rafRef = useRef<number | null>(null);
  const skippedRef = useRef(false);

  const color = drop ? RARITY_COLORS[drop.rarity] : "rgb(var(--g-cyan))";
  const glowWorthy = drop != null && GLOW_WORTHY.includes(drop.rarity);

  useEffect(() => {
    if (reducedMotion) return; // already settled at final values above

    const slideT = setTimeout(() => {
      if (skippedRef.current) return;
      setStage("counting");
      const start = performance.now();
      const duration = 400;
      const tick = (now: number) => {
        if (skippedRef.current) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setXpShown(Math.round(eased * xpAwarded));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setStage(glowWorthy ? "glow" : "done");
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 180);

    return () => {
      clearTimeout(slideT);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The user can tap through at any point — jump straight to the end state. */
  function skip() {
    if (stage === "done" || (stage === "glow" && xpShown === xpAwarded)) return;
    skippedRef.current = true;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    setXpShown(xpAwarded);
    setStage(glowWorthy ? "glow" : "done");
  }

  const canContinue = stage === "done" || stage === "glow";

  return (
    <div
      onClick={stage !== "done" && stage !== "glow" ? skip : undefined}
      className="fixed inset-x-0 bottom-0 z-50 animate-g-slide-up border-t p-5"
      style={{
        borderColor: color,
        background: "rgb(var(--g-surface))",
        boxShadow: stage === "glow" ? `0 0 32px 4px ${color}88` : `0 0 20px 0 ${color}33`,
      }}
    >
      <div className="mx-auto max-w-lg">
        {drop ? (
          <p
            className="font-game-body text-xs font-semibold uppercase tracking-wide"
            style={{ color }}
          >
            {drop.rarity} drop — {drop.name}
          </p>
        ) : null}

        <p className="mt-1 font-game-display text-3xl font-extrabold tabular-nums" style={{ color }}>
          +{xpShown} XP
        </p>

        {canContinue ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md py-3 font-game-body text-sm font-semibold text-game-void"
            style={{ background: color }}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <p className="mt-4 font-game-body text-xs text-game-text-dim">Tap to skip</p>
        )}
      </div>
    </div>
  );
}
