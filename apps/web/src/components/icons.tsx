import React, { type ReactNode } from "react";

export type IconName = "path" | "crew" | "shop" | "me" | "plus" | "close" | "check" | "lock" | "bolt" | "shard" | "flame" | "barbell" | "gift" | "eye" | "chevron" | "book" | "clock" | "shield" | "camera" | "pencil" | "bulb" | "briefcase" | "coin" | "wrench" | "heart" | "compass" | "gem" | "gemFacet" | "crown" | "flag" | "back";

/* Tones reproduce the export's filled status glyphs, which are drawn with a
   fill plus a contrasting stroke rather than the default outline treatment. */
export type IconTone = "flame" | "shard" | "bolt" | "shardSoft" | "ember";

const paths: Record<IconName, ReactNode> = {
  path: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  crew: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  shop: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
  me: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>,
  shard: <><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M2 9h20"/><path d="M11 3 8 9l4 13 4-13-3-6"/></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>,
  barbell: <><path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3 9v6"/><path d="M21 9v6"/><path d="M6.5 12h11"/></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  chevron: <path d="M6 9l6 6 6-6"/>,
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></>,
  pencil: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
  bulb: <><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"/></>,
  briefcase: <><path d="M3 7h18v12H3z"/><path d="M16 13h2M3 7l3-4h12l3 4"/></>,
  coin: <><circle cx="12" cy="12" r="9"/><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5M12 6v12"/></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>,
  heart: <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>,
  compass: <><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/></>,
  gem: <path d="M6 3h12l4 6-10 13L2 9Z"/>,
  gemFacet: <><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M2 9h20"/></>,
  crown: <path d="M2 18h20l-2-11-5 5-3-7-3 7-5-5z"/>,
  flag: <><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></>,
  back: <path d="M15 18l-6-6 6-6"/>,
};

const tones: Record<IconTone, { fill: string; stroke: string; strokeWidth: number }> = {
  flame: { fill: "#FF8A1F", stroke: "#FF8A1F", strokeWidth: 1.5 },
  shard: { fill: "#9BEAF0", stroke: "#15A9B8", strokeWidth: 2 },
  bolt: { fill: "#FFC53D", stroke: "#E0A000", strokeWidth: 1.5 },
  shardSoft: { fill: "#CDB8FF", stroke: "#6F42E8", strokeWidth: 2 },
  ember: { fill: "#FF8A1F", stroke: "#E0660A", strokeWidth: 1.5 },
};

export function Icon({ name, tone, strokeWidth }: { name: IconName; tone?: IconTone; strokeWidth?: number }) {
  const painted = tone ? tones[tone] : null;
  return (
    <svg
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      fill={painted?.fill ?? "none"}
      stroke={painted?.stroke ?? "currentColor"}
      strokeWidth={strokeWidth ?? painted?.strokeWidth ?? 2.5}
      strokeLinecap={painted ? undefined : "round"}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
