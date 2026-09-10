/** Colour helpers for the layered SVG avatar parts. Pure — no React, no IO. */

export interface AvatarPalette {
  /** Skin / body colour. */
  skinTone: string;
  /** Hair colour. */
  hairColor: string;
  /** Primary accent — drives outfits and trim. Reuses Profile.avatarColor. */
  color: string;
}

export interface PartProps extends AvatarPalette {
  /**
   * Unique per rendered avatar. Parts that declare gradients or filters must
   * namespace their element ids with this, or several avatars on the same
   * page (the friends list, the shop grid) will collide and share fills.
   */
  uid: string;
}

function clamp255(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

/** Lighten (positive amount) or darken (negative) a hex colour. */
export function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return hex;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = clamp255(((n >> 16) & 255) + amount);
  const g = clamp255(((n >> 8) & 255) + amount);
  const b = clamp255((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Readable foreground (near-black or near-white) for a given background. */
export function contrastOn(hex: string): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return "#ffffff";
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Rec. 601 luma
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#1c1917" : "#ffffff";
}

export const DEFAULT_PALETTE: AvatarPalette = {
  skinTone: "#e8b89b",
  hairColor: "#2d2418",
  color: "#6366f1",
};

/** Preset swatches offered in the avatar creator. */
export const SKIN_TONES = [
  "#f8d9c4",
  "#e8b89b",
  "#d19a73",
  "#b07a4f",
  "#8a5a37",
  "#5c3a23",
  "#3d2617",
];

export const HAIR_COLORS = [
  "#0f0d0b",
  "#2d2418",
  "#5a3a1e",
  "#8a5a2b",
  "#c08a4a",
  "#e0c088",
  "#9ca3af",
  "#e5e7eb",
  "#b91c1c",
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
];
