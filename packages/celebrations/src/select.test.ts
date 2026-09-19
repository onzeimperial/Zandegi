import { describe, it, expect } from "vitest";
import { selectCelebrationClip } from "./select";
import type { CelebrationClip } from "./types";

function clip(overrides: Partial<CelebrationClip>): CelebrationClip {
  return {
    id: "clip-1",
    domain: "Body",
    eventType: "step_complete",
    variant: 1,
    videoUrl: "https://example.invalid/clip-1.mp4",
    durationSec: 4,
    hasAudio: true,
    prompt: "test prompt",
    model: "doubao-seedance-1-5-pro-251215",
    generatedAt: "2026-09-19T00:00:00.000Z",
    sourceTaskId: "task-1",
    ...overrides,
  };
}

describe("selectCelebrationClip", () => {
  it("returns null for an empty library", () => {
    expect(
      selectCelebrationClip({ eventType: "step_complete", domain: "Body", seed: "evt-1" }, []),
    ).toBeNull();
  });

  it("is deterministic: same seed always returns the same clip", () => {
    const library = [
      clip({ id: "a", variant: 1 }),
      clip({ id: "b", variant: 2 }),
      clip({ id: "c", variant: 3 }),
    ];
    const input = { eventType: "step_complete" as const, domain: "Body" as const, seed: "evt-42" };
    const first = selectCelebrationClip(input, library);
    for (let i = 0; i < 10; i++) {
      expect(selectCelebrationClip(input, library)).toEqual(first);
    }
  });

  it("distributes across variants for different seeds", () => {
    const library = [
      clip({ id: "a", variant: 1 }),
      clip({ id: "b", variant: 2 }),
      clip({ id: "c", variant: 3 }),
    ];
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const picked = selectCelebrationClip(
        { eventType: "step_complete", domain: "Body", seed: `evt-${i}` },
        library,
      );
      if (picked) results.add(picked.id);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("only picks clips matching the exact domain and event type when available", () => {
    const library = [
      clip({ id: "body-step", domain: "Body", eventType: "step_complete" }),
      clip({ id: "mind-step", domain: "Mind", eventType: "step_complete" }),
      clip({ id: "body-chapter", domain: "Body", eventType: "chapter_complete" }),
    ];
    const picked = selectCelebrationClip(
      { eventType: "step_complete", domain: "Body", seed: "evt-1" },
      library,
    );
    expect(picked?.id).toBe("body-step");
  });

  it("falls back to the Universal base tier when the domain has no clip of its own", () => {
    const library = [clip({ id: "universal-step", domain: "Universal", eventType: "step_complete" })];
    const picked = selectCelebrationClip(
      { eventType: "step_complete", domain: "Body", seed: "evt-1" },
      library,
    );
    expect(picked?.id).toBe("universal-step");
  });

  it("does not borrow an unrelated domain's clip when no Universal fallback exists", () => {
    const library = [clip({ id: "mind-step", domain: "Mind", eventType: "step_complete" })];
    const picked = selectCelebrationClip(
      { eventType: "step_complete", domain: "Body", seed: "evt-1" },
      library,
    );
    expect(picked).toBeNull();
  });

  it("returns null when no clip matches the event type at all", () => {
    const library = [clip({ id: "mind-step", domain: "Mind", eventType: "step_complete" })];
    const picked = selectCelebrationClip(
      { eventType: "level_up", domain: "Mind", seed: "evt-1" },
      library,
    );
    expect(picked).toBeNull();
  });
});
