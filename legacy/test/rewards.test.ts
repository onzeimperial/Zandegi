import { describe, it, expect } from "vitest";
import { computeTaskXp } from "@/server/xp/rewards";

describe("computeTaskXp", () => {
  it("scales with difficulty", () => {
    const easy = computeTaskXp({ baseReward: 100, difficulty: 1 });
    const hard = computeTaskXp({ baseReward: 100, difficulty: 5 });
    expect(hard).toBeGreaterThan(easy);
  });

  it("rewards higher self-rated performance", () => {
    const low = computeTaskXp({ baseReward: 100, difficulty: 3, performance: 10 });
    const high = computeTaskXp({ baseReward: 100, difficulty: 3, performance: 95 });
    expect(high).toBeGreaterThan(low);
  });

  it("applies a small penalty for late completion", () => {
    const onTime = computeTaskXp({ baseReward: 100, difficulty: 3, onTime: true });
    const late = computeTaskXp({ baseReward: 100, difficulty: 3, onTime: false });
    expect(late).toBeLessThan(onTime);
  });

  it("never returns less than 1", () => {
    expect(computeTaskXp({ baseReward: 0, difficulty: 1, performance: 0 })).toBeGreaterThanOrEqual(1);
  });

  it("treats missing performance as neutral (no bonus, no penalty)", () => {
    const neutral = computeTaskXp({ baseReward: 100, difficulty: 3 });
    const midPerf = computeTaskXp({ baseReward: 100, difficulty: 3, performance: 67 });
    // ~0.6 + 0.67*0.6 = ~1.0 multiplier — close to neutral
    expect(Math.abs(neutral - midPerf)).toBeLessThan(neutral * 0.15);
  });

  it("clamps performance outside 0..100", () => {
    const over = computeTaskXp({ baseReward: 100, difficulty: 3, performance: 999 });
    const at100 = computeTaskXp({ baseReward: 100, difficulty: 3, performance: 100 });
    expect(over).toBe(at100);
  });
});
