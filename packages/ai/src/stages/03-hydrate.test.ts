import { describe, it, expect } from "vitest";
import { hydrate } from "./03-hydrate";
import type { ResolvedPursuit } from "../types";

const resolved: ResolvedPursuit = {
  slug: "test",
  domains: { Body: 1 },
  goalType: "METRIC",
  effortBand: "SEASON",
  safetyClass: "NORMAL",
  difficultyPrior: 1,
  antiPatterns: [],
  usedGenericScaffold: true,
};

describe("hydrate", () => {
  it("is a no-op — no knowledge layer exists yet", async () => {
    expect(await hydrate(resolved)).toEqual([]);
  });
});
