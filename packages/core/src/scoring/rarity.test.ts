import { describe, it, expect } from "vitest";
import {
  RARITY_TIERS,
  rarityTierFromPopulation,
  rarityScoreFromPopulation,
  rarityHeadline,
} from "./rarity";
import { rarityMult } from "./xp";

describe("rarityTierFromPopulation", () => {
  it("maps the spec's bands (SPEC §4.3)", () => {
    expect(rarityTierFromPopulation(0.6)).toBe("Common"); // > 40%
    expect(rarityTierFromPopulation(0.4)).toBe("Uncommon"); // boundary
    expect(rarityTierFromPopulation(0.2)).toBe("Uncommon");
    expect(rarityTierFromPopulation(0.15)).toBe("Rare");
    expect(rarityTierFromPopulation(0.1)).toBe("Rare");
    expect(rarityTierFromPopulation(0.05)).toBe("Epic");
    expect(rarityTierFromPopulation(0.02)).toBe("Epic");
    expect(rarityTierFromPopulation(0.01)).toBe("Legendary");
    expect(rarityTierFromPopulation(0.005)).toBe("Legendary");
    expect(rarityTierFromPopulation(0.001)).toBe("Mythic");
    expect(rarityTierFromPopulation(0.0001)).toBe("Mythic");
  });

  it("clamps and returns a known tier for any input", () => {
    for (let f = -0.5; f <= 1.5; f += 0.05) {
      expect(RARITY_TIERS).toContain(rarityTierFromPopulation(f));
    }
  });

  it("rarer never maps to a more common tier", () => {
    let prevIdx = 0;
    for (let f = 0; f <= 1; f += 0.01) {
      const idx = RARITY_TIERS.indexOf(rarityTierFromPopulation(f));
      expect(idx).toBeLessThanOrEqual(prevIdx || RARITY_TIERS.length);
      prevIdx = idx;
    }
  });
});

describe("rarityScoreFromPopulation feeds the XP formula correctly", () => {
  it("a marathon done by 0.7% pays close to the full rarity bonus", () => {
    const score = rarityScoreFromPopulation(0.007);
    expect(score).toBeCloseTo(0.993);
    expect(rarityMult(score)).toBeCloseTo(1.4965, 3);
  });

  it("something everyone does gives no rarity bonus", () => {
    expect(rarityMult(rarityScoreFromPopulation(1))).toBe(1);
  });
});

describe("rarityHeadline", () => {
  it("formats the share-card line at sensible precision", () => {
    expect(rarityHeadline(0.007, "finished a marathon")).toBe(
      "Only 0.7% of Zandegi have finished a marathon.",
    );
    expect(rarityHeadline(0.42, "kept a 30-day streak")).toBe(
      "Only 42% of Zandegi have kept a 30-day streak.",
    );
    expect(rarityHeadline(0.0004, "done this")).toBe("Only 0.04% of Zandegi have done this.");
  });
});
