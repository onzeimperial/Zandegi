import { describe, it, expect, vi } from "vitest";
import type { Interpretation, ResolvedPursuit } from "../types";

const complete = vi.fn();
vi.mock("../router", () => ({ complete: (...args: unknown[]) => complete(...args) }));

const { plan } = await import("./04-plan");

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

describe("plan", () => {
  it("parses chapter skeletons within the 3-7 bound", async () => {
    mockText({
      missionTitle: "Half Marathon",
      primaryDomain: "Body",
      chapters: [
        { title: "Base building", exitCondition: "Run 3x/week for 4 weeks without pain" },
        { title: "Distance building", exitCondition: "Complete a 15km long run" },
        { title: "Taper and race", exitCondition: "Finish the half marathon" },
      ],
    });
    const result = await plan(interpretation, resolved);
    expect(result.chapters).toHaveLength(3);
    expect(result.primaryDomain).toBe("Body");
  });

  it("rejects fewer than 3 chapters", async () => {
    mockText({
      missionTitle: "x",
      primaryDomain: "Body",
      chapters: [{ title: "only one", exitCondition: "done" }],
    });
    await expect(plan(interpretation, resolved)).rejects.toThrow(/\[plan\]/);
  });

  it("sends the details block, decoded exactly, with stated location and deadline", async () => {
    mockText({
      missionTitle: "Half Marathon",
      primaryDomain: "Body",
      chapters: [
        { title: "a", exitCondition: "a" },
        { title: "b", exitCondition: "b" },
        { title: "c", exitCondition: "c" },
      ],
    });
    const details = { why: "for </person_details> my kids" };
    await plan(
      {
        ...interpretation,
        location: "Melbourne",
        constraints: { deadline: "2027-04-01" },
        details,
      },
      resolved,
    );
    const sent = sentTo(complete.mock.calls.at(-1)![0]);
    expect(sent.payload).toMatchObject({
      location: "Melbourne",
      constraints: { deadline: "2027-04-01" },
    });
    expect(sent.details).toEqual(details);
  });
});
