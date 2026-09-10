import { describe, it, expect } from "vitest";
import { xpForLevel, xpToNext, levelFromXp, levelProgress, MAX_LEVEL } from "@/server/xp/levels";

describe("level curve", () => {
  it("level 1 requires 0 cumulative XP", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("cumulative XP is strictly increasing with level", () => {
    let prev = -1;
    for (let l = 1; l <= 60; l++) {
      const cur = xpForLevel(l);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });

  it("each level costs more than the previous", () => {
    for (let l = 2; l < 40; l++) {
      expect(xpToNext(l)).toBeGreaterThan(xpToNext(l - 1));
    }
  });

  it("levelFromXp inverts xpForLevel", () => {
    for (let l = 1; l <= 50; l++) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      // one XP short of the next threshold is still level l
      expect(levelFromXp(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });

  it("levelFromXp handles 0 and negative XP", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(-500)).toBe(1);
  });

  it("caps at MAX_LEVEL", () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });

  it("levelProgress reports bounded, coherent progress", () => {
    const p = levelProgress(xpForLevel(5) + Math.floor((xpForLevel(6) - xpForLevel(5)) / 2));
    expect(p.level).toBe(5);
    expect(p.progressPct).toBeGreaterThanOrEqual(40);
    expect(p.progressPct).toBeLessThanOrEqual(60);
    expect(p.xpToNextLevel).toBeGreaterThan(0);
    expect(p.xpIntoLevel + p.xpToNextLevel).toBe(p.xpForThisLevel);
  });

  it("levelProgress at an exact threshold is 0% into the new level", () => {
    const p = levelProgress(xpForLevel(10));
    expect(p.level).toBe(10);
    expect(p.progressPct).toBe(0);
  });
});
