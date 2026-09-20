import { describe, it, expect, vi } from "vitest";
import type { Interpretation } from "../types";

const complete = vi.fn();
vi.mock("../router", () => ({ complete: (...args: unknown[]) => complete(...args) }));

const { resolve } = await import("./02-resolve");

function mockText(obj: unknown) {
  complete.mockResolvedValueOnce({ text: JSON.stringify(obj), model: "test", usage: { inputTokens: 0, outputTokens: 0 } });
}

const interpretation: Interpretation = {
  intent: "Run a half marathon in April",
  goalType: "METRIC",
  constraints: {},
  timeBudgetMinutesPerWeek: 240,
  pursuitMatches: [],
  notes: {},
};

describe("resolve", () => {
  it("always falls through to the generic scaffold (no Pursuit catalog exists)", async () => {
    mockText({ domains: { Body: 1 }, effortBand: "SEASON", safetyClass: "NORMAL" });
    const result = await resolve(interpretation);
    expect(result.usedGenericScaffold).toBe(true);
    expect(result.difficultyPrior).toBe(1.0);
    expect(result.antiPatterns).toEqual([]);
  });

  it("derives a slug from the intent", async () => {
    mockText({ domains: { Body: 1 }, effortBand: "SEASON", safetyClass: "NORMAL" });
    const result = await resolve(interpretation);
    expect(result.slug).toBe("run-a-half-marathon-in-april");
  });

  it("preserves the classified safetyClass, including SELF_HARM_ADJACENT", async () => {
    mockText({ domains: { Grit: 1 }, effortBand: "LIFEWORK", safetyClass: "SELF_HARM_ADJACENT" });
    const result = await resolve({ ...interpretation, intent: "i want to die less" });
    expect(result.safetyClass).toBe("SELF_HARM_ADJACENT");
  });

  it("rejects domain weights that don't sum to 1", async () => {
    mockText({ domains: { Body: 0.5, Mind: 0.2 }, effortBand: "SEASON", safetyClass: "NORMAL" });
    await expect(resolve(interpretation)).rejects.toThrow(/sum to 1/);
  });

  it("rejects an unknown domain key", async () => {
    mockText({ domains: { NotADomain: 1 }, effortBand: "SEASON", safetyClass: "NORMAL" });
    await expect(resolve(interpretation)).rejects.toThrow(/\[resolve\]/);
  });
});
