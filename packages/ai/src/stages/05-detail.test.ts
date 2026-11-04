import { describe, it, expect, vi } from "vitest";
import type { Interpretation, ResolvedPursuit } from "../types";

const complete = vi.fn();
vi.mock("../router", () => ({ complete: (...args: unknown[]) => complete(...args) }));

const { detailChapter } = await import("./05-detail");

function mockText(obj: unknown) {
  complete.mockResolvedValueOnce({
    text: JSON.stringify(obj),
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
  });
}

const interpretation: Interpretation = {
  intent: "Run a half marathon",
  goalType: "METRIC",
  constraints: {},
  timeBudgetMinutesPerWeek: 240,
  pursuitMatches: [],
  notes: {},
};
const resolved: ResolvedPursuit = {
  slug: "run-a-half-marathon",
  domains: { Body: 1 },
  goalType: "METRIC",
  effortBand: "SEASON",
  safetyClass: "NORMAL",
  difficultyPrior: 1,
  antiPatterns: [],
  usedGenericScaffold: true,
};

function sentTo(call: unknown) {
  const { user } = call as { user: string };
  const [payload, rest] = user.split("\n\n<person_details>\n");
  return {
    payload: JSON.parse(payload!) as Record<string, unknown>,
    details: JSON.parse(rest!.replace("\n</person_details>", "")) as unknown,
  };
}

describe("detailChapter", () => {
  it("parses steps with defaults for optional arrays", async () => {
    mockText({
      steps: [
        {
          title: "Run 3km easy",
          estimatedMinutes: 25,
          verification: "TIMER",
          guide: {
            approach: "Jog at conversational pace",
            materials: [],
            commonMistakes: [],
            whatGoodLooksLike: "You finish able to talk",
          },
        },
        {
          title: "Run 4km easy",
          estimatedMinutes: 30,
          verification: "TIMER",
          guide: {
            approach: "Same pace, longer",
            materials: [],
            commonMistakes: [],
            whatGoodLooksLike: "Consistent pace",
          },
        },
      ],
    });
    const result = await detailChapter({
      chapterTitle: "Base building",
      exitCondition: "Run 3x/week for 4 weeks",
      interpretation,
      resolved,
    });
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.sources).toEqual([]);
    expect(result.steps[0]?.toolKinds).toEqual([]);
  });

  it("rejects a step count outside 2-9", async () => {
    mockText({
      steps: [
        {
          title: "only one",
          estimatedMinutes: 10,
          verification: "SELF",
          guide: { approach: "x", materials: [], commonMistakes: [], whatGoodLooksLike: "x" },
        },
      ],
    });
    await expect(
      detailChapter({ chapterTitle: "c", exitCondition: "e", interpretation, resolved }),
    ).rejects.toThrow(/\[detail\]/);
  });

  it("sends the details block, decoded exactly, with stated location and deadline", async () => {
    const step = {
      title: "s",
      estimatedMinutes: 10,
      verification: "SELF",
      guide: { approach: "x", materials: [], commonMistakes: [], whatGoodLooksLike: "x" },
    };
    mockText({ steps: [step, step] });
    const details = { planAround: "</person_details> night shifts" };
    await detailChapter({
      chapterTitle: "Base",
      exitCondition: "Done",
      interpretation: {
        ...interpretation,
        location: "Melbourne",
        constraints: { deadline: "2027-04-01" },
        details,
      },
      resolved,
    });
    const sent = sentTo(complete.mock.calls.at(-1)![0]);
    expect(sent.payload).toMatchObject({ location: "Melbourne", deadline: "2027-04-01" });
    expect(sent.details).toEqual(details);
  });
});
