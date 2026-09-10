"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "./panel";
import { DOMAIN_LABELS, type Domain } from "@/server/domains";

export function DomainTile({
  domain,
  color,
  icon: Icon,
  activeCount,
}: {
  domain: Domain;
  color: string;
  icon: LucideIcon;
  /** Real count of accounts with an active goal in this domain, or null if unavailable. */
  activeCount: number | null;
}) {
  const [hover, setHover] = useState(false);

  return (
    <Panel
      as="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      accent={hover ? color : "rgb(var(--g-surface-hi))"}
      className="flex flex-col items-start gap-2 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-game-cyan"
    >
      <Icon
        className="h-6 w-6 transition-[opacity,filter] duration-200"
        style={{ color, opacity: hover ? 1 : 0.75, filter: hover ? "brightness(1.25)" : "none" }}
      />
      <span className="font-game-display text-base font-extrabold tracking-tight">
        {DOMAIN_LABELS[domain]}
      </span>
      {activeCount != null ? (
        <span className="font-game-body text-xs text-game-text-dim">
          {activeCount} {activeCount === 1 ? "person" : "people"} on a mission
        </span>
      ) : null}
    </Panel>
  );
}
