import { describe, it, expect } from "vitest";
import { xpForLevel, levelFromXp, levelProgress, rankForLevel, RANKS, MAX_LEVEL } from "./levels";

describe("xpForLevel", () => {
  it("level 1 costs nothing", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("is exactly round(100 × n^1.6)", () => {
    for (const l of [2, 5, 10, 25, 50, 100, 200]) {
      expect(xpForLevel(l)).toBe(Math.round(100 * Math.pow(l, 1.6)));
    }
  });

  it("lands in the neighbourhood of the spec's stated reference points", () => {
    // SPEC §4.2 gives these as "≈" — the formula is authoritative, these are
    // sanity checks that it produces the right order of magnitude.
    const near = (actual: number, approx: number) =>
      expect(Math.abs(actual - approx) / approx).toBeLessThan(0.1);
    near(xpForLevel(10), 4000);
    near(xpForLevel(25), 17500);
    near(xpForLevel(50), 53000);
    near(xpForLevel(100), 160000);
  });

  it("is strictly increasing", () => {
    for (let l = 1; l < 200; l++) {
      expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    }
  });
});

describe("levelFromXp", () => {
  it("inverts xpForLevel exactly at the boundaries", () => {
    for (const l of [1, 2, 5, 10, 25, 50, 100, 250]) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l) - 1)).toBe(l - 1 || 1);
    }
  });

  it("clamps at zero and the floor", () => {
    expect(levelFromXp(-100)).toBe(1);
    expect(levelFromXp(0)).toBe(1);
  });

  it("never exceeds MAX_LEVEL", () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });
});

describe("levelProgress", () => {
  it("reports position within the current level", () => {
    const floor = xpForLevel(10);
    const ceil = xpForLevel(11);
    const mid = floor + Math.floor((ceil - floor) / 2);
    const p = levelProgress(mid);
    expect(p.level).toBe(10);
    expect(p.xpIntoLevel).toBe(mid - floor);
    expect(p.xpToNextLevel).toBe(ceil - mid);
    expect(p.progressPct).toBeGreaterThanOrEqual(49);
    expect(p.progressPct).toBeLessThanOrEqual(51);
    expect(p.isMax).toBe(false);
  });

  it("is 0% exactly at a level floor", () => {
    expect(levelProgress(xpForLevel(20)).progressPct).toBe(0);
  });
});

describe("rankForLevel", () => {
  it("promotes exactly at each band boundary (SPEC §4.2)", () => {
    expect(rankForLevel(1)).toBe("Wanderer");
    expect(rankForLevel(9)).toBe("Wanderer");
    expect(rankForLevel(10)).toBe("Seeker");
    expect(rankForLevel(19)).toBe("Seeker");
    expect(rankForLevel(20)).toBe("Adept");
    expect(rankForLevel(34)).toBe("Adept");
    expect(rankForLevel(35)).toBe("Vanguard");
    expect(rankForLevel(55)).toBe("Ascendant");
    expect(rankForLevel(80)).toBe("Mythic");
    expect(rankForLevel(100)).toBe("Eternal");
    expect(rankForLevel(9999)).toBe("Eternal");
  });

  it("never goes backwards as level rises", () => {
    let prevIdx = 0;
    for (let l = 1; l <= 150; l++) {
      const idx = RANKS.findIndex((r) => r.name === rankForLevel(l));
      expect(idx).toBeGreaterThanOrEqual(prevIdx);
      prevIdx = idx;
    }
  });
});
