import { describe, expect, it, vi } from "vitest";
import { fixedClock } from "../ports";
import {
  DEFAULT_DAILY_GENERATION_LIMIT,
  claimDailyGeneration,
  dailyGenerationLimitFromEnv,
} from "./usage";

const principal = { id: "p-1" };
const clock = fixedClock(new Date("2026-11-04T23:59:59.000Z"));

describe("the daily generation limit", () => {
  it("defaults to five and reads the environment", () => {
    expect(DEFAULT_DAILY_GENERATION_LIMIT).toBe(5);
    expect(dailyGenerationLimitFromEnv({})).toBe(5);
    expect(dailyGenerationLimitFromEnv({ ZANDEGI_DAILY_GENERATION_LIMIT: "12" })).toBe(12);
    expect(dailyGenerationLimitFromEnv({ ZANDEGI_DAILY_GENERATION_LIMIT: "0" })).toBe(0);
  });

  it.each(["", "lots", "-1", "2.5", "Infinity"])("does not let %j lift the cap", (value) => {
    expect(dailyGenerationLimitFromEnv({ ZANDEGI_DAILY_GENERATION_LIMIT: value })).toBe(5);
  });

  it("claims against the UTC day", async () => {
    const claimSlot = vi.fn(async () => true);
    await claimDailyGeneration({ principal, limit: 3 }, { usage: { claimSlot }, clock });
    expect(claimSlot).toHaveBeenCalledWith("p-1", "2026-11-04", 3);
  });

  it("refuses with the stable code when no slot is free", async () => {
    await expect(
      claimDailyGeneration(
        { principal, limit: 3 },
        { usage: { claimSlot: async () => false }, clock },
      ),
    ).rejects.toMatchObject({ code: "DAILY_LIMIT_REACHED" });
  });
});
