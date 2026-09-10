import { describe, it, expect } from "vitest";
import { COSMETICS, DEFAULT_COSMETIC_KEYS, cosmeticsForSlot } from "@/server/cosmetics/definitions";
import { registeredKeys, getPart } from "@/components/avatar/parts";
import { COSMETIC_SLOTS, RARITIES } from "@/lib/constants";

describe("cosmetic definitions", () => {
  it("has a unique key per item", () => {
    const keys = COSMETICS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only uses known slots and rarities", () => {
    for (const c of COSMETICS) {
      expect(COSMETIC_SLOTS).toContain(c.slot);
      expect(RARITIES).toContain(c.rarity);
    }
  });

  it("every definition can actually be drawn by the SVG registry", () => {
    for (const c of COSMETICS) {
      expect(getPart(c.slot, c.key), `no SVG part registered for "${c.key}"`).not.toBeNull();
    }
  });

  it("every drawable part has a definition backing it", () => {
    const defined = new Set(COSMETICS.map((c) => c.key));
    for (const slot of COSMETIC_SLOTS) {
      for (const key of registeredKeys(slot)) {
        expect(defined.has(key), `SVG part "${key}" has no CosmeticDef`).toBe(true);
      }
    }
  });

  it("gives every slot at least one option a new user owns", () => {
    const defaults = new Set(DEFAULT_COSMETIC_KEYS);
    // Optional slots may legitimately start empty ("none").
    const required = ["base", "face", "hair", "outfit", "frame"] as const;
    for (const slot of required) {
      const owned = cosmeticsForSlot(slot).filter((c) => defaults.has(c.key));
      expect(owned.length, `slot "${slot}" has no default item`).toBeGreaterThan(0);
    }
  });

  it("never prices a default item", () => {
    for (const c of COSMETICS) {
      if (c.isDefault) expect(c.price).toBeNull();
    }
  });

  it("prices ascend with rarity on purchasable items", () => {
    const buyable = COSMETICS.filter((c) => c.price != null);
    for (const c of buyable) {
      const rank = RARITIES.indexOf(c.rarity);
      const cheaperTiers = buyable.filter((o) => RARITIES.indexOf(o.rarity) < rank);
      for (const cheaper of cheaperTiers) {
        expect(c.price!, `${c.key} (${c.rarity}) should cost more than ${cheaper.key} (${cheaper.rarity})`)
          .toBeGreaterThan(cheaper.price!);
      }
    }
  });

  it("reserves mythic items for drops only", () => {
    for (const c of COSMETICS.filter((c) => c.rarity === "mythic")) {
      expect(c.price, `${c.key} should not be purchasable`).toBeNull();
    }
  });

  it("renders nothing for an unequipped optional slot", () => {
    expect(getPart("accessory", "none")).toBeNull();
    expect(getPart("aura", "none")).toBeNull();
  });
});
