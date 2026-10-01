/* The customiser's catalogue and selection rules, taken from the authored
   Claude Design board. Cosmetics only: nothing here touches XP, levels,
   streaks or rank. Locked entries state what unlocks them and can never be
   selected, so the reducer is the single gate. */

export type SwatchTab = "skin" | "hair" | "hoodie" | "pants" | "shoes";
export type CustomiseTab = SwatchTab | "extras";
export type ExtraKey = "cap" | "glasses" | "phones" | "band" | "crown";

export interface Swatch {
  label: string;
  value: string;
  lock?: string;
}

export interface HairSwatch extends Swatch { style: "buzz" | "crop" | "curls" | "knot" }
export interface HoodieSwatch extends Swatch { shade: string }
export interface PantsSwatch extends Swatch { stripe: 0 | 1 }
export interface ShoeSwatch extends Swatch { accent: string }

export interface Extra {
  key: ExtraKey;
  label: string;
  p1: string;
  p2: string;
  lock?: string;
}

export const SKINS: readonly Swatch[] = [
  { label: "Tone 1", value: "#F6D3BA" }, { label: "Tone 2", value: "#EBBE9C" }, { label: "Tone 3", value: "#C98E65" },
  { label: "Tone 4", value: "#9A6243" }, { label: "Tone 5", value: "#6B412B" },
];

export const HAIRS: readonly HairSwatch[] = [
  { label: "Buzz", value: "#D9CBB8", style: "buzz" },
  { label: "Crop", value: "#2A1E1A", style: "crop" },
  { label: "Curls", value: "#5A3825", style: "curls" },
  { label: "Top knot", value: "#1E1A24", style: "knot" },
  { label: "Lilac crop", value: "#B79CFF", style: "crop", lock: "Lv 20" },
];

export const HOODIES: readonly HoodieSwatch[] = [
  { label: "Amethyst", value: "#6F42E8", shade: "#5227C9" }, { label: "Midnight", value: "#2B2350", shade: "#1B1538" },
  { label: "Ember", value: "#E8662A", shade: "#C24E17" }, { label: "Mint", value: "#3BBF9A", shade: "#279878" },
  { label: "Rose", value: "#E0508F", shade: "#BF3A74" }, { label: "Gold", value: "#E8B530", shade: "#C7951A", lock: "Lv 20" },
];

export const PANTS: readonly PantsSwatch[] = [
  { label: "Amethyst", value: "#5227C9", stripe: 1 }, { label: "Charcoal", value: "#3A3548", stripe: 1 },
  { label: "Sand", value: "#CDB38A", stripe: 0 }, { label: "Denim", value: "#3F63A8", stripe: 0 },
];

export const SHOES: readonly ShoeSwatch[] = [
  { label: "Classic", value: "#FFFFFF", accent: "#6F42E8" }, { label: "Blackout", value: "#2B2350", accent: "#FFFFFF" },
  { label: "Ember", value: "#FFFFFF", accent: "#E8662A" }, { label: "Neon", value: "#D8FF3D", accent: "#241257", lock: "150 Shards" },
];

export const EXTRAS: readonly Extra[] = [
  { key: "cap", label: "Cap", p1: "M4 15a8 8 0 0 1 16 0z", p2: "M3 15h19" },
  { key: "glasses", label: "Glasses", p1: "M2 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0M14 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0", p2: "M10 13h4" },
  { key: "phones", label: "Headphones", p1: "M3 18v-6a9 9 0 0 1 18 0v6", p2: "M3 14h4v6H3zM17 14h4v6h-4z" },
  { key: "band", label: "Sweatband", p1: "M3 13c0-5 4-8 9-8s9 3 9 8", p2: "M4 11h16" },
  { key: "crown", label: "Crown", p1: "M2 18h20l-2-11-5 5-3-7-3 7-5-5z", p2: "", lock: "Chest reward" },
];

export const SWATCHES: Record<SwatchTab, readonly Swatch[]> = {
  skin: SKINS, hair: HAIRS, hoodie: HOODIES, pants: PANTS, shoes: SHOES,
};

export const TABS: ReadonlyArray<{ key: CustomiseTab; label: string }> = [
  { key: "skin", label: "Skin" }, { key: "hair", label: "Hair" }, { key: "hoodie", label: "Top" },
  { key: "pants", label: "Pants" }, { key: "shoes", label: "Shoes" }, { key: "extras", label: "Extras" },
];

export interface CustomiseState {
  tab: CustomiseTab;
  selected: Record<SwatchTab, number>;
  extras: Partial<Record<ExtraKey, boolean>>;
}

export const initialCustomiseState: CustomiseState = {
  tab: "hoodie",
  selected: { skin: 1, hair: 0, hoodie: 0, pants: 0, shoes: 0 },
  extras: {},
};

export type CustomiseAction =
  | { type: "tab"; tab: CustomiseTab }
  | { type: "select"; tab: SwatchTab; index: number }
  | { type: "toggle-extra"; key: ExtraKey }
  | { type: "reset" };

export function customiseReducer(state: CustomiseState, action: CustomiseAction): CustomiseState {
  if (action.type === "reset") return initialCustomiseState;
  if (action.type === "tab") return { ...state, tab: action.tab };

  if (action.type === "select") {
    const swatch = SWATCHES[action.tab][action.index];
    if (!swatch || swatch.lock) return state;
    return { ...state, selected: { ...state.selected, [action.tab]: action.index } };
  }

  const extra = EXTRAS.find((candidate) => candidate.key === action.key);
  if (!extra || extra.lock) return state;
  return { ...state, extras: { ...state.extras, [action.key]: !state.extras[action.key] } };
}

/* A cap replaces the hair silhouette, and hides the sweatband, exactly as the
   authored board does. */
export function characterLook(state: CustomiseState) {
  const hair = HAIRS[state.selected.hair] ?? HAIRS[0]!;
  const hoodie = HOODIES[state.selected.hoodie] ?? HOODIES[0]!;
  const pants = PANTS[state.selected.pants] ?? PANTS[0]!;
  const shoe = SHOES[state.selected.shoes] ?? SHOES[0]!;
  const skin = SKINS[state.selected.skin] ?? SKINS[0]!;
  const cap = Boolean(state.extras.cap);
  return {
    skin: skin.value,
    hair: hair.value,
    hairStyle: cap ? null : hair.style,
    hoodie: hoodie.value,
    hoodieShade: hoodie.shade,
    pants: pants.value,
    stripe: pants.stripe,
    shoe: shoe.value,
    shoeAccent: shoe.accent,
    cap,
    glasses: Boolean(state.extras.glasses),
    phones: Boolean(state.extras.phones),
    band: Boolean(state.extras.band) && !cap,
  };
}

export type CharacterLook = ReturnType<typeof characterLook>;
