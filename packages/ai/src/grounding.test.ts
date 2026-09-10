import { describe, it, expect } from "vitest";
import {
  detectFactualClaims,
  isValidSource,
  validateStepGrounding,
  validateMissionGrounding,
  isFullyGrounded,
} from "./grounding";
import type { DraftStep, DraftMission, Source } from "./types";

const NOW = new Date("2026-06-15T00:00:00Z");

function step(overrides: Partial<DraftStep> = {}): DraftStep {
  return {
    index: 0,
    title: "Warm up",
    estimatedMinutes: 20,
    verification: "SELF",
    guide: { approach: "Do an easy jog.", materials: [], commonMistakes: [], whatGoodLooksLike: "Loose." },
    sources: [],
    toolKinds: [],
    ...overrides,
  };
}

describe("detectFactualClaims", () => {
  it("flags prices, percentages, deadlines, requirements and named rules", () => {
    expect(detectFactualClaims("The course costs $1,200.")).toHaveLength(1);
    expect(detectFactualClaims("Around 30% of applicants get an offer.")).toHaveLength(1);
    expect(detectFactualClaims("Applications close on 30 September.")).toHaveLength(1);
    expect(detectFactualClaims("You must have a minimum ATAR of 95.")).toHaveLength(1);
    expect(detectFactualClaims("A Commonwealth Supported Place caps your fees.")).toHaveLength(1);
  });

  it("does not flag ordinary advice", () => {
    expect(detectFactualClaims("Run three times this week and rest when sore.")).toEqual([]);
    expect(detectFactualClaims("Pick a quiet room and put your phone in another one.")).toEqual([]);
  });

  it("splits multi-sentence text and flags only the factual sentences", () => {
    const text = "Start with easy runs. The race entry fee is $85. Build up slowly.";
    expect(detectFactualClaims(text)).toEqual(["The race entry fee is $85."]);
  });
});

describe("isValidSource", () => {
  const ok: Source = { title: "Official UCAT site", url: "https://x", date: "2026-01-10" };

  it("accepts a titled, recently-dated source", () => {
    expect(isValidSource(ok, NOW)).toBe(true);
  });

  it("rejects a missing or trivial title", () => {
    expect(isValidSource({ ...ok, title: "" }, NOW)).toBe(false);
    expect(isValidSource({ ...ok, title: "x" }, NOW)).toBe(false);
  });

  it("rejects an unparseable or absurd date", () => {
    expect(isValidSource({ ...ok, date: "soon" }, NOW)).toBe(false);
    expect(isValidSource({ ...ok, date: "2099-01-01" }, NOW)).toBe(false); // too far future
    expect(isValidSource({ ...ok, date: "2010-06-01" }, NOW)).toBe(true); // within 30y window
    expect(isValidSource({ ...ok, date: "1980-01-01" }, NOW)).toBe(false); // older than 30y = not fresh
  });
});

describe("validateStepGrounding", () => {
  it("passes a step with no factual claims", () => {
    expect(validateStepGrounding(step(), NOW).ungrounded).toEqual([]);
  });

  it("flags a factual claim with no source", () => {
    const s = step({
      guide: {
        approach: "The application fee is $130.",
        materials: [],
        commonMistakes: [],
        whatGoodLooksLike: "Submitted.",
      },
    });
    expect(validateStepGrounding(s, NOW).ungrounded).toHaveLength(1);
  });

  it("passes the same claim once a valid dated source is attached", () => {
    const s = step({
      guide: {
        approach: "The application fee is $130.",
        materials: [],
        commonMistakes: [],
        whatGoodLooksLike: "Submitted.",
      },
      sources: [{ title: "Provider fee schedule", date: "2026-02-01" }],
    });
    expect(validateStepGrounding(s, NOW).ungrounded).toEqual([]);
  });

  it("still flags when the only source has a bad date", () => {
    const s = step({
      title: "Pay the $130 fee",
      sources: [{ title: "Some page", date: "whenever" }],
    });
    expect(validateStepGrounding(s, NOW).ungrounded.length).toBeGreaterThan(0);
  });
});

describe("validateMissionGrounding", () => {
  const mission: DraftMission = {
    title: "Get into medicine",
    goalType: "OUTCOME",
    primaryDomain: "Edge",
    chapters: [
      {
        index: 0,
        title: "Understand the pathway",
        exitCondition: "Know your target course's requirements",
        steps: [
          step({ index: 0, title: "Map the pathway", guide: step().guide }),
          step({
            index: 1,
            title: "Note key dates",
            guide: {
              approach: "The GAMSAT is held in March and September.",
              materials: [],
              commonMistakes: [],
              whatGoodLooksLike: "Dates in your calendar.",
            },
          }),
        ],
      },
    ],
  };

  it("counts claims and reports the ungrounded ones with their location", () => {
    const report = validateMissionGrounding(mission, NOW);
    expect(report.claimsChecked).toBeGreaterThan(0);
    expect(report.ungroundedClaims).toEqual([
      { chapterIndex: 0, stepIndex: 1, claim: expect.stringContaining("GAMSAT") },
    ]);
    expect(isFullyGrounded(report)).toBe(false);
  });

  it("is fully grounded once every claim-bearing step has a source", () => {
    const fixed: DraftMission = {
      ...mission,
      chapters: [
        {
          ...mission.chapters[0]!,
          steps: [
            mission.chapters[0]!.steps[0]!,
            {
              ...mission.chapters[0]!.steps[1]!,
              sources: [{ title: "Official GAMSAT site", date: "2026-01-05" }],
            },
          ],
        },
      ],
    };
    expect(isFullyGrounded(validateMissionGrounding(fixed, NOW))).toBe(true);
  });
});
