import { DEFAULT_PALETTE } from "./palette";

/**
 * Pure avatar config — deliberately NOT a client module.
 *
 * avatar-render.tsx is "use client" (it uses useId), so server components and
 * server services cannot call functions defined there. These helpers live here
 * so both sides can share them.
 */

/** The equipped-cosmetic shape stored on Profile. */
export interface AvatarConfig {
  base: string;
  face: string;
  hair: string;
  outfit: string;
  accessory: string;
  aura: string;
  frame: string;
  skinTone: string;
  hairColor: string;
  color: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  base: "base_default",
  face: "face_default",
  hair: "hair_default",
  outfit: "outfit_default",
  accessory: "none",
  aura: "none",
  frame: "frame_default",
  ...DEFAULT_PALETTE,
};

/** Build a config from a Profile row, tolerating missing/legacy columns. */
export function avatarFromProfile(profile: {
  avatarBase?: string | null;
  avatarFace?: string | null;
  avatarHair?: string | null;
  avatarOutfit?: string | null;
  avatarAccessory?: string | null;
  avatarAura?: string | null;
  avatarFrame?: string | null;
  avatarSkinTone?: string | null;
  avatarHairColor?: string | null;
  avatarColor?: string | null;
}): AvatarConfig {
  return {
    base: profile.avatarBase || DEFAULT_AVATAR.base,
    face: profile.avatarFace || DEFAULT_AVATAR.face,
    hair: profile.avatarHair || DEFAULT_AVATAR.hair,
    outfit: profile.avatarOutfit || DEFAULT_AVATAR.outfit,
    accessory: profile.avatarAccessory || DEFAULT_AVATAR.accessory,
    aura: profile.avatarAura || DEFAULT_AVATAR.aura,
    frame: profile.avatarFrame || DEFAULT_AVATAR.frame,
    skinTone: profile.avatarSkinTone || DEFAULT_AVATAR.skinTone,
    hairColor: profile.avatarHairColor || DEFAULT_AVATAR.hairColor,
    color: profile.avatarColor || DEFAULT_AVATAR.color,
  };
}
