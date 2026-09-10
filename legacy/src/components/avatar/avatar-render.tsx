"use client";

import { useId } from "react";
import { COSMETIC_SLOTS, type CosmeticSlot } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getPart } from "./parts";
import { DEFAULT_AVATAR, type AvatarConfig } from "./config";

export { DEFAULT_AVATAR, avatarFromProfile } from "./config";
export type { AvatarConfig } from "./config";

export interface AvatarRenderProps {
  config?: Partial<AvatarConfig>;
  size?: number;
  className?: string;
  /** Renders the frame slot. Turn off for inline busts inside another border. */
  showFrame?: boolean;
  title?: string;
}

/**
 * Composes the equipped cosmetics into one SVG. Layer order comes from
 * COSMETIC_SLOTS, which is declared back-to-front.
 */
export function AvatarRender({
  config,
  size = 96,
  className,
  showFrame = true,
  title,
}: AvatarRenderProps) {
  const uid = useId().replace(/:/g, "");
  const cfg: AvatarConfig = { ...DEFAULT_AVATAR, ...config };
  const palette = {
    skinTone: cfg.skinTone,
    hairColor: cfg.hairColor,
    color: cfg.color,
    uid,
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Clip the body to the portrait circle so shoulders don't spill out. */}
      <defs>
        <clipPath id={`avatar-clip-${uid}`}>
          <circle cx="50" cy="50" r="46.5" />
        </clipPath>
      </defs>

      <g clipPath={`url(#avatar-clip-${uid})`}>
        <circle cx="50" cy="50" r="46.5" fill="currentColor" className="text-surface" />
        {COSMETIC_SLOTS.filter((s) => s !== "frame").map((slot) => (
          <SlotLayer key={slot} slot={slot} cfg={cfg} palette={palette} />
        ))}
      </g>

      {showFrame ? <SlotLayer slot="frame" cfg={cfg} palette={palette} /> : null}
    </svg>
  );
}

function SlotLayer({
  slot,
  cfg,
  palette,
}: {
  slot: CosmeticSlot;
  cfg: AvatarConfig;
  palette: { skinTone: string; hairColor: string; color: string; uid: string };
}) {
  const Part = getPart(slot, cfg[slot]);
  if (!Part) return null;
  return <Part {...palette} />;
}
