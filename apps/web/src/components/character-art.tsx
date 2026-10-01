import React from "react";
import type { CharacterLook } from "@/app/customise/customise-state";

/* The character, drawn exactly as the authored board draws it. Every tunable
   fill comes from the look, so the art stays a pure function of the
   selection. */
export function CharacterArt({ look }: { look: CharacterLook }) {
  const on = (visible: boolean) => (visible ? 1 : 0);
  return (
    <svg className="character-art" width="340" height="493" viewBox="0 0 200 300" role="img" aria-label="Your character preview">
      <ellipse cx="100" cy="288" rx="62" ry="8" fill="#241257" opacity="0.12" />

      <rect x="56" y="258" width="42" height="24" rx="11" fill={look.shoe} />
      <rect x="102" y="258" width="42" height="24" rx="11" fill={look.shoe} />
      <path d="M63 270 Q76 261 91 267" fill="none" stroke={look.shoeAccent} strokeWidth="4" strokeLinecap="round" />
      <path d="M109 267 Q124 261 137 270" fill="none" stroke={look.shoeAccent} strokeWidth="4" strokeLinecap="round" />
      <rect x="56" y="277" width="42" height="6" rx="3" fill="#CFC0FF" />
      <rect x="102" y="277" width="42" height="6" rx="3" fill="#CFC0FF" />

      <rect x="64" y="204" width="32" height="62" rx="10" fill={look.pants} />
      <rect x="104" y="204" width="32" height="62" rx="10" fill={look.pants} />
      <rect x="66" y="210" width="5" height="50" rx="2.5" fill="#FFFFFF" opacity={look.stripe} />
      <rect x="129" y="210" width="5" height="50" rx="2.5" fill="#FFFFFF" opacity={look.stripe} />

      <rect x="34" y="156" width="28" height="58" rx="13" fill={look.hoodie} />
      <rect x="138" y="156" width="28" height="58" rx="13" fill={look.hoodie} />
      <rect x="36" y="164" width="5" height="42" rx="2.5" fill="#FFFFFF" opacity="0.9" />
      <rect x="159" y="164" width="5" height="42" rx="2.5" fill="#FFFFFF" opacity="0.9" />
      <circle cx="48" cy="218" r="11" fill={look.skin} />
      <circle cx="152" cy="218" r="11" fill={look.skin} />

      <rect x="56" y="148" width="88" height="68" rx="22" fill={look.hoodie} />
      <rect x="76" y="190" width="48" height="18" rx="8" fill={look.hoodieShade} />
      <ellipse cx="100" cy="150" rx="36" ry="12" fill={look.hoodieShade} />
      <path d="M94 156v16M106 156v16" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <text x="112" y="184" fontFamily="Baloo 2, ui-rounded, sans-serif" fontSize="16" fontWeight="800" fill="#FFFFFF">Z</text>

      <circle cx="43" cy="98" r="12" fill={look.skin} />
      <circle cx="157" cy="98" r="12" fill={look.skin} />
      <circle cx="100" cy="92" r="58" fill={look.skin} />
      <ellipse cx="70" cy="118" rx="10" ry="6" fill="#FF7A9A" opacity="0.3" />
      <ellipse cx="130" cy="118" rx="10" ry="6" fill="#FF7A9A" opacity="0.3" />
      <rect x="66" y="80" width="22" height="6" rx="3" fill="#3A2A22" />
      <rect x="112" y="80" width="22" height="6" rx="3" fill="#3A2A22" />
      <ellipse cx="78" cy="101" rx="9" ry="11" fill="#2A1A14" />
      <ellipse cx="122" cy="101" rx="9" ry="11" fill="#2A1A14" />
      <circle cx="81" cy="97" r="3" fill="#FFFFFF" />
      <circle cx="125" cy="97" r="3" fill="#FFFFFF" />
      <ellipse cx="100" cy="114" rx="5" ry="4" fill="#241257" opacity="0.1" />
      <path d="M90 124 Q100 132 110 124" fill="none" stroke="#6B3A2A" strokeWidth="3" strokeLinecap="round" />

      <path opacity={on(look.hairStyle === "buzz")} fill={look.hair} d="M44 84 C46 50 72 36 100 36 C128 36 154 50 156 84 C150 66 128 56 100 56 C72 56 50 66 44 84 Z" />
      <path opacity={on(look.hairStyle === "crop")} fill={look.hair} d="M40 90 C38 46 70 28 100 28 C130 28 162 46 160 90 C156 74 148 66 138 64 C120 72 90 72 64 62 C52 68 44 78 40 90 Z" />
      <g opacity={on(look.hairStyle === "curls")} fill={look.hair}>
        <circle cx="52" cy="68" r="16" /><circle cx="70" cy="46" r="18" /><circle cx="100" cy="38" r="20" /><circle cx="130" cy="46" r="18" /><circle cx="148" cy="68" r="16" /><circle cx="85" cy="56" r="14" /><circle cx="115" cy="56" r="14" />
      </g>
      <g opacity={on(look.hairStyle === "knot")} fill={look.hair}>
        <path d="M42 86 C42 48 70 32 100 32 C130 32 158 48 158 86 C152 64 130 54 100 54 C70 54 48 64 42 86 Z" />
        <circle cx="100" cy="24" r="15" />
      </g>

      <rect opacity={on(look.band)} x="49" y="58" width="102" height="12" rx="6" fill="#FF8A1F" />
      <g opacity={on(look.cap)}>
        <path d="M42 84 C42 44 70 28 100 28 C130 28 158 44 158 84 Z" fill="#5227C9" />
        <rect x="38" y="78" width="124" height="12" rx="6" fill="#241257" />
        <text x="92" y="68" fontFamily="Baloo 2, ui-rounded, sans-serif" fontSize="20" fontWeight="800" fill="#FFFFFF">Z</text>
      </g>
      <g opacity={on(look.glasses)} fill="#FFFFFF" fillOpacity="0.15" stroke="#241257" strokeWidth="4">
        <circle cx="78" cy="101" r="16" /><circle cx="122" cy="101" r="16" />
        <path d="M94 99h12" fill="none" />
      </g>
      <g opacity={on(look.phones)}>
        <path d="M38 100 C38 30 162 30 162 100" fill="none" stroke="#241257" strokeWidth="8" strokeLinecap="round" />
        <rect x="28" y="84" width="22" height="32" rx="9" fill="#6F42E8" />
        <rect x="150" y="84" width="22" height="32" rx="9" fill="#6F42E8" />
      </g>
    </svg>
  );
}
