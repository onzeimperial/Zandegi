import { DOMAINS, type Domain } from "@zandegi/core";
import type { IconName } from "@/components/icons";

/* The Claude Design mock labelled its eight stat tiles with placeholder names
   (Learning, Wealth, Spirit, Adventure). SPEC.md §1.1 and `@zandegi/core` fix
   the real eight "forever", so the canonical names win and the mock's glyphs
   are mapped onto them. */
export const DOMAIN_ICONS: Record<Domain, IconName> = {
  Mind: "bulb",
  Edge: "briefcase",
  Coin: "coin",
  Body: "barbell",
  Grit: "flame",
  Craft: "wrench",
  Bond: "heart",
  World: "compass",
};

export const DOMAIN_ORDER: readonly Domain[] = DOMAINS;
