import { describe, it, expect } from "vitest";
import {
  SAFETY_CLASSES,
  isGenerationBlocked,
  requiresProfessionalFrame,
} from "./safety";

describe("safety classes", () => {
  it("has the five spec classes", () => {
    expect(SAFETY_CLASSES).toEqual([
      "NORMAL",
      "CLINICAL",
      "FINANCIAL",
      "LEGAL",
      "SELF_HARM_ADJACENT",
    ]);
  });

  it("only SELF_HARM_ADJACENT blocks generation entirely", () => {
    expect(isGenerationBlocked("SELF_HARM_ADJACENT")).toBe(true);
    for (const c of SAFETY_CLASSES) {
      if (c !== "SELF_HARM_ADJACENT") expect(isGenerationBlocked(c)).toBe(false);
    }
  });

  it("CLINICAL, FINANCIAL and LEGAL require a professional-guidance frame", () => {
    expect(requiresProfessionalFrame("CLINICAL")).toBe(true);
    expect(requiresProfessionalFrame("FINANCIAL")).toBe(true);
    expect(requiresProfessionalFrame("LEGAL")).toBe(true);
    expect(requiresProfessionalFrame("NORMAL")).toBe(false);
    expect(requiresProfessionalFrame("SELF_HARM_ADJACENT")).toBe(false); // blocked, not framed
  });
});
