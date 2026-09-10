import { describe, it, expect } from "vitest";
import {
  seededRandom,
  rollRarity,
  rollDrop,
  shouldDropOnMilestone,
  tierBelow,
  type DropCandidate,
} from "@/server/cosmetics/drops";
import { COSMETICS } from "@/server/cosmetics/definitions";
import { RARITIES, type Rarity } from "@/lib/constants";

const POOL: DropCandidate[] = COSMETICS.map((c) => ({
  key: c.key,
  rarity: c.rarity,
  ...(c.isDefault ? { isDefault: true } : {}),
  ...(c.unlockAchievementKey ? { unlockAchievementKey: c.unlockAchievementKey } : {}),
}));

describe("seededRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRandom("user1:goal1");
    const b = seededRandom("user1:goal1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs across seeds", () => {
    expect(seededRandom("user1:goalA")()).not.toBe(seededRandom("user1:goalB")());
  });

  it("stays within [0, 1)", () => {
    const rng = seededRandom("range-check");
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rollRarity", () => {
  it("never rolls below the floor", () => {
    for (const floor of RARITIES) {
      for (let i = 0; i < 200; i++) {
        const rolled = rollRarity(floor, seededRandom(`seed-${floor}-${i}`));
        expect(RARITIES.indexOf(rolled)).toBeGreaterThanOrEqual(RARITIES.indexOf(floor));
      }
    }
  });

  it("never rolls more than two tiers above the floor", () => {
    for (const floor of RARITIES) {
      for (let i = 0; i < 200; i++) {
        const rolled = rollRarity(floor, seededRandom(`bump-${floor}-${i}`));
        expect(RARITIES.indexOf(rolled) - RARITIES.indexOf(floor)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("cannot exceed mythic", () => {
    for (let i = 0; i < 100; i++) {
      expect(rollRarity("mythic", seededRandom(`cap-${i}`))).toBe("mythic");
    }
  });

  it("lands on the floor most of the time", () => {
    let atFloor = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (rollRarity("rare", seededRandom(`dist-${i}`)) === "rare") atFloor++;
    }
    expect(atFloor / n).toBeGreaterThan(0.7);
  });
});

describe("rollDrop", () => {
  it("is deterministic for a given seed", () => {
    const args = { seed: "u1:g1", floor: "rare" as Rarity, pool: POOL, ownedKeys: [] };
    expect(rollDrop(args)).toEqual(rollDrop(args));
  });

  it("never drops a default item", () => {
    const defaults = new Set(COSMETICS.filter((c) => c.isDefault).map((c) => c.key));
    for (let i = 0; i < 300; i++) {
      const d = rollDrop({ seed: `def-${i}`, floor: "common", pool: POOL, ownedKeys: [] });
      if (d) expect(defaults.has(d.key)).toBe(false);
    }
  });

  it("never drops an achievement-locked item", () => {
    const gated = new Set(
      COSMETICS.filter((c) => c.unlockAchievementKey).map((c) => c.key),
    );
    for (let i = 0; i < 300; i++) {
      const d = rollDrop({ seed: `gate-${i}`, floor: "legendary", pool: POOL, ownedKeys: [] });
      if (d) expect(gated.has(d.key)).toBe(false);
    }
  });

  it("never drops something already owned", () => {
    const owned = COSMETICS.filter((c) => c.rarity === "rare").map((c) => c.key);
    for (let i = 0; i < 200; i++) {
      const d = rollDrop({ seed: `own-${i}`, floor: "rare", pool: POOL, ownedKeys: owned });
      if (d) expect(owned).not.toContain(d.key);
    }
  });

  it("never drops above the rolled tier", () => {
    for (let i = 0; i < 300; i++) {
      const d = rollDrop({ seed: `tier-${i}`, floor: "common", pool: POOL, ownedKeys: [] });
      // floor common + max 2 tiers => at most "rare"
      if (d) expect(RARITIES.indexOf(d.rarity)).toBeLessThanOrEqual(RARITIES.indexOf("rare"));
    }
  });

  it("falls back down a tier when the rolled tier is exhausted", () => {
    // Own every mythic and legendary; a mythic floor must still yield something.
    const owned = COSMETICS.filter((c) => c.rarity === "mythic" || c.rarity === "legendary").map(
      (c) => c.key,
    );
    const d = rollDrop({ seed: "fallback", floor: "mythic", pool: POOL, ownedKeys: owned });
    expect(d).not.toBeNull();
    expect(RARITIES.indexOf(d!.rarity)).toBeLessThan(RARITIES.indexOf("mythic"));
  });

  it("returns null when everything droppable is owned", () => {
    const all = COSMETICS.map((c) => c.key);
    expect(rollDrop({ seed: "exhausted", floor: "mythic", pool: POOL, ownedKeys: all })).toBeNull();
  });

  it("can actually reach mythic from a mythic floor", () => {
    const d = rollDrop({ seed: "myth", floor: "mythic", pool: POOL, ownedKeys: [] });
    expect(d?.rarity).toBe("mythic");
  });
});

describe("milestone drops", () => {
  it("is deterministic", () => {
    expect(shouldDropOnMilestone("m1")).toBe(shouldDropOnMilestone("m1"));
  });

  it("fires roughly a quarter of the time", () => {
    let hits = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (shouldDropOnMilestone(`ms-${i}`)) hits++;
    expect(hits / n).toBeGreaterThan(0.18);
    expect(hits / n).toBeLessThan(0.32);
  });
});

describe("tierBelow", () => {
  it("steps down one tier", () => {
    expect(tierBelow("mythic")).toBe("legendary");
    expect(tierBelow("rare")).toBe("uncommon");
  });

  it("bottoms out at common", () => {
    expect(tierBelow("common")).toBe("common");
  });
});
