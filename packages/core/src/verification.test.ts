import { describe, it, expect } from "vitest";
import { VERIFICATION_METHODS, verificationMult } from "./verification";

describe("verification multipliers (SPEC §4.1)", () => {
  it("has the five methods", () => {
    expect(VERIFICATION_METHODS).toEqual([
      "SELF",
      "TIMER",
      "ARTIFACT",
      "METRIC",
      "INTEGRATION",
    ]);
  });

  it("pays exactly the spec values", () => {
    expect(verificationMult("SELF")).toBe(1.0);
    expect(verificationMult("TIMER")).toBe(1.15);
    expect(verificationMult("ARTIFACT")).toBe(1.25);
    expect(verificationMult("METRIC")).toBe(1.3);
    expect(verificationMult("INTEGRATION")).toBe(1.4);
  });

  it("stronger evidence never pays less", () => {
    const order = VERIFICATION_METHODS.map(verificationMult);
    const sorted = [...order].sort((a, b) => a - b);
    expect(order).toEqual(sorted);
  });
});
