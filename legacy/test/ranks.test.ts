import { describe, it, expect } from "vitest";
import { RANKS, rankForLevel, nextRank, levelsToNextRank } from "@/server/xp/ranks";
import { MAX_LEVEL } from "@/server/xp/levels";

describe("ranks", () => {
  it("starts every account at the lowest rank", () => {
    expect(rankForLevel(1).name).toBe(RANKS[0]!.name);
  });

  it("returns a rank for every valid level", () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(RANKS.map((r) => r.name)).toContain(rankForLevel(l).name);
    }
  });

  it("never goes backwards as level rises", () => {
    let prev = 0;
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const idx = RANKS.findIndex((r) => r.name === rankForLevel(l).name);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });

  it("promotes exactly at each band boundary", () => {
    for (const r of RANKS.slice(1)) {
      expect(rankForLevel(r.from).name).toBe(r.name);
      expect(rankForLevel(r.from - 1).name).not.toBe(r.name);
    }
  });

  it("has ascending, unique bands", () => {
    const froms = RANKS.map((r) => r.from);
    expect([...froms].sort((a, b) => a - b)).toEqual(froms);
    expect(new Set(froms).size).toBe(froms.length);
  });

  it("clamps out-of-range levels", () => {
    expect(rankForLevel(0).name).toBe(RANKS[0]!.name);
    expect(rankForLevel(-5).name).toBe(RANKS[0]!.name);
    expect(rankForLevel(99999).name).toBe(RANKS[RANKS.length - 1]!.name);
  });

  it("reports the next rank until the top band", () => {
    expect(nextRank(1)?.name).toBe(RANKS[1]!.name);
    expect(nextRank(MAX_LEVEL)).toBeNull();
  });

  it("counts levels to the next rank", () => {
    const second = RANKS[1]!;
    expect(levelsToNextRank(second.from - 1)).toBe(1);
    expect(levelsToNextRank(MAX_LEVEL)).toBeNull();
  });
});
