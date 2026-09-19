import { describe, it, expect } from "vitest";
import { DOMAINS } from "@zandegi/core";
import { buildCelebrationPrompt } from "./prompt";
import { CELEBRATION_EVENT_TYPES } from "./types";

describe("buildCelebrationPrompt", () => {
  it("is non-empty and deterministic for every domain and event type", () => {
    for (const domain of DOMAINS) {
      for (const eventType of CELEBRATION_EVENT_TYPES) {
        const a = buildCelebrationPrompt(domain, eventType, 1);
        const b = buildCelebrationPrompt(domain, eventType, 1);
        expect(a.length).toBeGreaterThan(0);
        expect(a).toBe(b);
      }
    }
  });

  it("mentions the domain name so prompts aren't interchangeable across domains", () => {
    const body = buildCelebrationPrompt("Body", "step_complete", 1);
    const mind = buildCelebrationPrompt("Mind", "step_complete", 1);
    expect(body).toContain("Body");
    expect(mind).toContain("Mind");
    expect(body).not.toBe(mind);
  });

  it("scales intensity language with event type", () => {
    const step = buildCelebrationPrompt("Grit", "step_complete", 1);
    const chapter = buildCelebrationPrompt("Grit", "chapter_complete", 1);
    const levelUp = buildCelebrationPrompt("Grit", "level_up", 1);
    expect(step).not.toBe(chapter);
    expect(chapter).not.toBe(levelUp);
    expect(levelUp).toContain("biggest celebration");
  });

  it("differs across variants of the same (domain, eventType)", () => {
    const v1 = buildCelebrationPrompt("Craft", "chapter_complete", 1);
    const v2 = buildCelebrationPrompt("Craft", "chapter_complete", 2);
    expect(v1).not.toBe(v2);
  });
});
