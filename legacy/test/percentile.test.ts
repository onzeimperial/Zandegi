import { describe, it, expect } from "vitest";
import {
  tierFromFraction,
  tierFromAuthored,
  resolveTier,
  PERCENTILE_TIERS,
  MIN_ACCOUNTS_FOR_PERCENTILE,
} from "@/server/rarity/percentile";

describe("tierFromFraction", () => {
  it("treats zero unlocks as the rarest tier", () => {
    expect(tierFromFraction(0)).toBe("legendary");
  });

  it("treats near-universal unlocks as common", () => {
    expect(tierFromFraction(1)).toBe("common");
    expect(tierFromFraction(0.9)).toBe("common");
  });

  it("clamps out-of-range fractions instead of throwing", () => {
    expect(tierFromFraction(-5)).toBe("legendary");
    expect(tierFromFraction(50)).toBe("common");
  });

  it("never returns anything outside the defined ladder", () => {
    for (let f = 0; f <= 1; f += 0.01) {
      expect(PERCENTILE_TIERS).toContain(tierFromFraction(f));
    }
  });

  it("is monotonic — rarer fraction never yields a more common tier", () => {
    let prevRank: number = PERCENTILE_TIERS.length; // start above the top
    for (let f = 0; f <= 1; f += 0.01) {
      const rank = PERCENTILE_TIERS.indexOf(tierFromFraction(f));
      expect(rank).toBeLessThanOrEqual(prevRank);
      prevRank = rank;
    }
  });
});

describe("tierFromAuthored", () => {
  it("maps every authored tier to a real percentile tier", () => {
    expect(tierFromAuthored("bronze")).toBe("uncommon");
    expect(tierFromAuthored("silver")).toBe("rare");
    expect(tierFromAuthored("gold")).toBe("epic");
    expect(tierFromAuthored("platinum")).toBe("legendary");
  });

  it("keeps authored ordering intact", () => {
    const order = ["bronze", "silver", "gold", "platinum"] as const;
    const ranks = order.map((t) => PERCENTILE_TIERS.indexOf(tierFromAuthored(t)));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});

describe("resolveTier", () => {
  it("falls back to the authored tier below the account threshold", () => {
    const r = resolveTier({ unlockedCount: 0, totalAccounts: 1, authoredTier: "gold" });
    expect(r.isProvisional).toBe(true);
    expect(r.percentile).toBeNull();
    expect(r.tier).toBe(tierFromAuthored("gold"));
  });

  it("uses the real percentile once enough accounts exist", () => {
    const r = resolveTier({
      unlockedCount: 1,
      totalAccounts: MIN_ACCOUNTS_FOR_PERCENTILE,
      authoredTier: "bronze",
    });
    expect(r.isProvisional).toBe(false);
    expect(r.percentile).not.toBeNull();
  });

  it("reports percentile as how much rarer, not how common", () => {
    // 1 of 100 unlocked it -> "rarer than 99%".
    const r = resolveTier({ unlockedCount: 1, totalAccounts: 100, authoredTier: "bronze" });
    expect(r.percentile).toBe(99);
  });

  it("sits right at the threshold boundary consistently", () => {
    const below = resolveTier({
      unlockedCount: 5,
      totalAccounts: MIN_ACCOUNTS_FOR_PERCENTILE - 1,
      authoredTier: "silver",
    });
    const at = resolveTier({
      unlockedCount: 5,
      totalAccounts: MIN_ACCOUNTS_FOR_PERCENTILE,
      authoredTier: "silver",
    });
    expect(below.isProvisional).toBe(true);
    expect(at.isProvisional).toBe(false);
  });
});
