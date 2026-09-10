import { describe, it, expect } from "vitest";
import {
  DOMAINS,
  isDomain,
  domainWeightSum,
  assertDomainWeights,
  primaryDomain,
  type DomainWeight,
} from "./domains";

describe("domains", () => {
  it("has exactly the eight fixed domains", () => {
    expect(DOMAINS).toEqual(["Mind", "Edge", "Coin", "Body", "Grit", "Craft", "Bond", "World"]);
    expect(new Set(DOMAINS).size).toBe(8);
  });

  it("isDomain accepts the eight and rejects anything else", () => {
    for (const d of DOMAINS) expect(isDomain(d)).toBe(true);
    expect(isDomain("mind")).toBe(false); // case-sensitive
    expect(isDomain("Money")).toBe(false);
    expect(isDomain("")).toBe(false);
  });
});

describe("domain weights", () => {
  it("sums correctly", () => {
    expect(domainWeightSum({ Body: 0.8, Grit: 0.2 })).toBeCloseTo(1);
    expect(domainWeightSum({})).toBe(0);
  });

  it("accepts weights that sum to 1", () => {
    expect(() => assertDomainWeights({ Body: 0.8, Grit: 0.2 })).not.toThrow();
    expect(() => assertDomainWeights({ Mind: 1 })).not.toThrow();
    expect(() =>
      assertDomainWeights({ Mind: 0.34, Edge: 0.33, Coin: 0.33 }),
    ).not.toThrow(); // within epsilon
  });

  it("rejects weights that don't sum to 1", () => {
    expect(() => assertDomainWeights({ Body: 0.8, Grit: 0.3 })).toThrow(/sum to 1/);
    expect(() => assertDomainWeights({ Body: 0.5 })).toThrow(/sum to 1/);
  });

  it("rejects an empty split", () => {
    expect(() => assertDomainWeights({})).toThrow(/at least one/);
  });

  it("rejects out-of-range or non-numeric weights", () => {
    expect(() => assertDomainWeights({ Body: 0, Grit: 1 } as DomainWeight)).toThrow(/\(0, 1\]/);
    expect(() => assertDomainWeights({ Body: -0.2, Grit: 1.2 })).toThrow();
    expect(() => assertDomainWeights({ Body: NaN } as DomainWeight)).toThrow();
  });

  it("rejects an unknown domain key", () => {
    expect(() => assertDomainWeights({ Money: 1 } as unknown as DomainWeight)).toThrow(/unknown domain/);
  });
});

describe("primaryDomain", () => {
  it("returns the heaviest-weighted domain", () => {
    expect(primaryDomain({ Body: 0.8, Grit: 0.2 })).toBe("Body");
    expect(primaryDomain({ Mind: 0.3, Edge: 0.5, Coin: 0.2 })).toBe("Edge");
  });

  it("is deterministic on ties (first wins)", () => {
    expect(primaryDomain({ Mind: 0.5, Edge: 0.5 })).toBe("Mind");
  });

  it("throws on empty", () => {
    expect(() => primaryDomain({})).toThrow();
  });
});
