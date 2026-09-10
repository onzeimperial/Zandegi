"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { RARITY_COLORS, RARITY_LABELS, type CosmeticSlot, type Rarity } from "@/lib/constants";
import { AvatarRender, type AvatarConfig } from "./avatar-render";

export interface Drop {
  key: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  rarity: Rarity;
  upgradedBy: number;
}

/**
 * Celebration shown when a goal or milestone gifts a cosmetic. Queues
 * multiple drops and reveals them one at a time.
 */
export function RewardReveal({
  drops,
  avatar,
  onClose,
}: {
  drops: Drop[];
  avatar?: AvatarConfig;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 30);
    return () => clearTimeout(t);
  }, [index]);

  const drop = drops[index];
  if (!drop) return null;

  const color = RARITY_COLORS[drop.rarity];
  const last = index === drops.length - 1;

  function next() {
    if (last) return onClose();
    setShown(false);
    setIndex((i) => i + 1);
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${RARITY_LABELS[drop.rarity]} reward: ${drop.name}`}
      onClick={next}
    >
      <div
        className="card relative w-full max-w-sm p-6 text-center transition-all duration-300"
        style={{
          borderColor: color,
          boxShadow: `0 0 0 1px ${color}44, 0 0 40px ${color}55`,
          transform: shown ? "scale(1)" : "scale(0.9)",
          opacity: shown ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-muted hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>

        <p
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{ color, background: `${color}1f` }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {RARITY_LABELS[drop.rarity]} drop
        </p>

        <div className="my-4 grid place-items-center">
          <AvatarRender
            config={{ ...avatar, [drop.slot]: drop.key }}
            size={168}
            showFrame={drop.slot === "frame"}
          />
        </div>

        <h2 className="text-lg font-semibold">{drop.name}</h2>
        <p className="mt-1 text-sm text-muted">{drop.description}</p>

        {drop.upgradedBy > 0 ? (
          <p className="mt-2 text-xs font-medium" style={{ color }}>
            Lucky roll — {drop.upgradedBy} tier{drop.upgradedBy > 1 ? "s" : ""} above the guaranteed reward
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Link href="/avatar" className="btn-outline flex-1" onClick={onClose}>
            Equip it
          </Link>
          <button onClick={next} className="btn-primary flex-1">
            {last ? "Nice" : `Next (${drops.length - index - 1} more)`}
          </button>
        </div>
      </div>
    </div>
  );
}
