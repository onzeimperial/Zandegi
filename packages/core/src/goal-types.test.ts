import { describe, it, expect } from "vitest";
import {
  GOAL_TYPES,
  progressDisplayAllowed,
  assertProgressDisplay,
  percentageAllowed,
} from "./goal-types";

describe("goal types", () => {
  it("has the five spec types", () => {
    expect(GOAL_TYPES).toEqual(["OUTCOME", "METRIC", "HABIT", "PROJECT", "EXPERIENCE"]);
  });
});

describe("assertProgressDisplay — product law 2, no fake precision", () => {
  it("an OUTCOME goal may only show chapters", () => {
    expect(() => assertProgressDisplay("OUTCOME", "CHAPTERS")).not.toThrow();
    expect(() => assertProgressDisplay("OUTCOME", "METRIC_BAR")).toThrow(/not permitted/);
    expect(() => assertProgressDisplay("OUTCOME", "SCOPE")).toThrow();
    expect(() => assertProgressDisplay("OUTCOME", "CONSISTENCY")).toThrow();
  });

  it("a METRIC goal may show a metric bar", () => {
    expect(() => assertProgressDisplay("METRIC", "METRIC_BAR")).not.toThrow();
  });

  it("a HABIT goal may show consistency but not a metric bar", () => {
    expect(() => assertProgressDisplay("HABIT", "CONSISTENCY")).not.toThrow();
    expect(() => assertProgressDisplay("HABIT", "METRIC_BAR")).toThrow();
  });

  it("a PROJECT goal may show finite scope", () => {
    expect(() => assertProgressDisplay("PROJECT", "SCOPE")).not.toThrow();
  });

  it("an EXPERIENCE goal may show a checklist but not a metric bar", () => {
    expect(() => assertProgressDisplay("EXPERIENCE", "CHECKLIST")).not.toThrow();
    expect(() => assertProgressDisplay("EXPERIENCE", "METRIC_BAR")).toThrow();
  });

  it("every goal type may fall back to chapters", () => {
    for (const gt of GOAL_TYPES) {
      expect(progressDisplayAllowed(gt, "CHAPTERS")).toBe(true);
    }
  });
});

describe("percentageAllowed", () => {
  it("is only true for METRIC and PROJECT", () => {
    expect(percentageAllowed("METRIC")).toBe(true);
    expect(percentageAllowed("PROJECT")).toBe(true);
    expect(percentageAllowed("OUTCOME")).toBe(false);
    expect(percentageAllowed("HABIT")).toBe(false);
    expect(percentageAllowed("EXPERIENCE")).toBe(false);
  });
});
