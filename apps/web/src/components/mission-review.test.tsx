import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import type { GenerationResult } from "@zandegi/api/client";
import { MissionReview } from "./mission-review";

function result(
  goalType: "OUTCOME" | "METRIC",
  professionalFrameApplied = false,
): GenerationResult {
  return {
    outcome: "mission",
    missionId: "mission-1",
    mission: {
      title: "Become a doctor",
      goalType,
      primaryDomain: "Mind",
      chapters: [
        {
          index: 0,
          title: "Know the pathway",
          exitCondition: "Gather entry evidence",
          steps: [
            {
              index: 0,
              title: "Read entry requirements",
              estimatedMinutes: 30,
              verification: "ARTIFACT",
              guide: {
                approach: "Capture the official requirements.",
                materials: [],
                commonMistakes: [],
                whatGoodLooksLike: "A dated note.",
              },
              toolKinds: [],
              sources: [],
            },
          ],
        },
      ],
    },
    safety: {
      safetyClass: professionalFrameApplied ? "CLINICAL" : "NORMAL",
      professionalFrameApplied,
    },
    grounding: { claimsChecked: 0, ungroundedClaims: 0, rewritten: 0, dropped: 0 },
    meta: {
      runId: "run-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:12.000Z",
      durationMs: 12_000,
    },
  };
}

describe("mission review", () => {
  it("uses qualitative progress for outcome goals and semantic disclosure controls", () => {
    const html = renderToStaticMarkup(<MissionReview result={result("OUTCOME")} />);
    expect(html).toContain("Honest progress");
    expect(html).not.toContain("Measurable progress");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Start chapter 1");
    expect(html).toContain("will not carry over");
  });
  it("allows measurable progress framing for metric goals", () => {
    expect(renderToStaticMarkup(<MissionReview result={result("METRIC")} />)).toContain(
      "Measurable progress",
    );
  });
  it("renders professional-guidance safety context when applied", () => {
    const html = renderToStaticMarkup(<MissionReview result={result("OUTCOME", true)} />);
    expect(html).toContain("Professional guidance applies");
    expect(html).toContain("qualified professional");
  });
  it("promises no XP and marks the time as an estimate (laws 2 and 3)", () => {
    const html = renderToStaticMarkup(<MissionReview result={result("METRIC")} />);
    // No per-step XP badge of any size, and no XP total.
    expect(html).not.toMatch(/\+\s*\d+\s*XP/);
    expect(html).not.toMatch(/\d+\s*XP/);
    expect(html).toContain("Est. 30 min");
    expect(html).toContain("planning estimates");
  });
  it("renders nothing for a refusal terminal", () => {
    const refusal: GenerationResult = {
      outcome: "refusal",
      refusal: { reason: "This needs a person, not a mission.", route: "support" },
      meta: result("METRIC").meta,
    };
    expect(renderToStaticMarkup(<MissionReview result={refusal} />)).toBe("");
  });
});
