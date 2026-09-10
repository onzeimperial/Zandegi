/**
 * String key -> SVG part component registry, one map per slot.
 * Mirrors the AchievementIcon registry in src/components/ui/icon.tsx.
 *
 * Keys here are the source of truth for CosmeticItem.key: a cosmetic whose
 * key has no entry in these maps simply renders nothing, so a bad DB row can
 * never crash an avatar.
 */

import type { ComponentType } from "react";
import type { CosmeticSlot } from "@/lib/constants";
import type { PartProps } from "../palette";

import { BaseDefault, BaseSlim, BaseBroad } from "./base";
import { FaceDefault, FaceCalm, FaceDetermined, FaceGrin } from "./face";
import { HairDefault, HairShort, HairLong, HairCurly, HairBun, HairSpiky } from "./hair";
import { OutfitDefault, OutfitHoodie, OutfitBlazer, OutfitAthletic, OutfitArmour } from "./outfit";
import {
  AccessoryGlasses,
  AccessoryHeadphones,
  AccessoryCrown,
  AccessoryScarf,
  AccessoryVisor,
} from "./accessory";
import { AuraGlow, AuraRings, AuraFlame, AuraSparks, AuraCosmic } from "./aura";
import { FrameDefault, FrameThin, FrameStudded, FrameLaurel, FrameRunic, FramePrismatic } from "./frame";

export type AvatarPart = ComponentType<PartProps>;

export const PART_REGISTRY: Record<CosmeticSlot, Record<string, AvatarPart>> = {
  base: {
    base_default: BaseDefault,
    base_slim: BaseSlim,
    base_broad: BaseBroad,
  },
  face: {
    face_default: FaceDefault,
    face_calm: FaceCalm,
    face_determined: FaceDetermined,
    face_grin: FaceGrin,
  },
  hair: {
    hair_default: HairDefault,
    hair_short: HairShort,
    hair_long: HairLong,
    hair_curly: HairCurly,
    hair_bun: HairBun,
    hair_spiky: HairSpiky,
  },
  outfit: {
    outfit_default: OutfitDefault,
    outfit_hoodie: OutfitHoodie,
    outfit_blazer: OutfitBlazer,
    outfit_athletic: OutfitAthletic,
    outfit_armour: OutfitArmour,
  },
  accessory: {
    acc_glasses: AccessoryGlasses,
    acc_headphones: AccessoryHeadphones,
    acc_crown: AccessoryCrown,
    acc_scarf: AccessoryScarf,
    acc_visor: AccessoryVisor,
  },
  aura: {
    aura_glow: AuraGlow,
    aura_rings: AuraRings,
    aura_flame: AuraFlame,
    aura_sparks: AuraSparks,
    aura_cosmic: AuraCosmic,
  },
  frame: {
    frame_default: FrameDefault,
    frame_thin: FrameThin,
    frame_studded: FrameStudded,
    frame_laurel: FrameLaurel,
    frame_runic: FrameRunic,
    frame_prismatic: FramePrismatic,
  },
};

/** "none" is a valid stored value for optional slots and renders nothing. */
export function getPart(slot: CosmeticSlot, key: string): AvatarPart | null {
  if (!key || key === "none") return null;
  return PART_REGISTRY[slot][key] ?? null;
}

/** Every key the registry can actually draw, used to validate seed data. */
export function registeredKeys(slot: CosmeticSlot): string[] {
  return Object.keys(PART_REGISTRY[slot]);
}
