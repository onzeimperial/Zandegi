import { shade, type PartProps } from "../palette";

/** Worn extras, drawn above the hair. */

export function AccessoryGlasses() {
  return (
    <>
      <circle cx="42.5" cy="35" r="6.5" fill="#fff" fillOpacity="0.16" stroke="#1c1917" strokeWidth="1.6" />
      <circle cx="57.5" cy="35" r="6.5" fill="#fff" fillOpacity="0.16" stroke="#1c1917" strokeWidth="1.6" />
      <path d="M49 35 L51 35" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M36 34 L31 32.5" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M64 34 L69 32.5" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

export function AccessoryHeadphones({ color }: PartProps) {
  return (
    <>
      <path d="M28 38 Q28 12 50 12 Q72 12 72 38" stroke={shade(color, -30)} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <rect x="24.5" y="34" width="8" height="13" rx="3.4" fill={color} />
      <rect x="67.5" y="34" width="8" height="13" rx="3.4" fill={color} />
    </>
  );
}

export function AccessoryCrown({ color }: PartProps) {
  const gold = "#f4c542";
  return (
    <>
      <path d="M33 18 L37.5 8.5 L43.5 15 L50 5 L56.5 15 L62.5 8.5 L67 18 Z" fill={gold} />
      <rect x="33" y="17" width="34" height="4.5" rx="1.6" fill={shade(gold, -28)} />
      <circle cx="50" cy="12.5" r="2" fill={color} />
    </>
  );
}

export function AccessoryScarf({ color }: PartProps) {
  return (
    <>
      <path d="M36 66 Q50 74 64 66 L64 72 Q50 80 36 72 Z" fill={color} />
      <path d="M60 71 L67 88 L60 86 L57 73 Z" fill={shade(color, -22)} />
    </>
  );
}

export function AccessoryVisor({ color }: PartProps) {
  return (
    <>
      <path d="M28 32 Q50 24 72 32 L72 39 Q50 33 28 39 Z" fill={shade(color, -34)} opacity="0.92" />
      <path d="M32 33.5 Q50 28 68 33.5" stroke={shade(color, 60)} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
    </>
  );
}
