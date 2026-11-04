import { describe, it, expect, vi } from "vitest";

const complete = vi.fn();
vi.mock("../router", () => ({ complete: (...args: unknown[]) => complete(...args) }));

const { interpret } = await import("./01-interpret");
const { interpretationOutputSchema } = await import("../schemas");

const NOW = new Date("2026-11-04T01:00:00Z");

function mockText(obj: unknown) {
  complete.mockResolvedValueOnce({
    text: JSON.stringify(obj),
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
  });
}

function sentTo(call: unknown) {
  const { user } = call as { user: string };
  const [payload, rest] = user.split("\n\n<person_details>\n");
  return {
    payload: JSON.parse(payload!) as Record<string, unknown>,
    details: JSON.parse(rest!.replace("\n</person_details>", "")) as unknown,
  };
}

describe("interpret", () => {
  it("parses a well-formed model response and forces pursuitMatches to empty", async () => {
    mockText({
      intent: "Run a half marathon",
      goalType: "METRIC",
      constraints: {},
      timeBudgetMinutesPerWeek: 240,
      notes: {},
    });
    const result = await interpret({ rawText: "run a half marathon in april" }, NOW);
    expect(result.goalType).toBe("METRIC");
    expect(result.pursuitMatches).toEqual([]);
  });

  it("strips a markdown fence if the model adds one", async () => {
    complete.mockResolvedValueOnce({
      text:
        "```json\n" +
        JSON.stringify({
          intent: "x",
          goalType: "HABIT",
          constraints: {},
          timeBudgetMinutesPerWeek: 60,
          notes: {},
        }) +
        "\n```",
      model: "test",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const result = await interpret({ rawText: "meditate daily" }, NOW);
    expect(result.goalType).toBe("HABIT");
  });

  it("throws a clear error on invalid JSON", async () => {
    mockText("not json");
    complete.mockReset();
    complete.mockResolvedValueOnce({
      text: "not valid json{",
      model: "test",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    await expect(interpret({ rawText: "x" }, NOW)).rejects.toThrow(/\[interpret\]/);
  });

  it("throws on schema violation (missing required field)", async () => {
    mockText({ intent: "x" });
    await expect(interpret({ rawText: "x" }, NOW)).rejects.toThrow(/\[interpret\]/);
  });

  it("flags impossible scope when the model says so", async () => {
    mockText({
      intent: "Become a billionaire",
      goalType: "METRIC",
      constraints: {},
      timeBudgetMinutesPerWeek: 180,
      notes: { isImpossibleScope: true },
    });
    const result = await interpret({ rawText: "become a billionaire by march" }, NOW);
    expect(result.notes.isImpossibleScope).toBe(true);
  });

  it("gives the stage today's date where the person is", async () => {
    mockText({
      intent: "x",
      goalType: "HABIT",
      constraints: {},
      timeBudgetMinutesPerWeek: 60,
      notes: {},
    });
    await interpret({ rawText: "x", timezone: "Pacific/Pago_Pago" }, NOW);
    const { user } = complete.mock.calls.at(-1)![0] as { user: string };
    expect(JSON.parse(user)).toMatchObject({ today: "2026-11-03" });
  });

  it("sends no details block for a goal on its own", async () => {
    mockText({
      intent: "x",
      goalType: "HABIT",
      constraints: {},
      timeBudgetMinutesPerWeek: 60,
      notes: {},
    });
    await interpret({ rawText: "x" }, NOW);
    const { user } = complete.mock.calls.at(-1)![0] as { user: string };
    expect(user).not.toContain("person_details");
  });

  it("sends the details block, decoded exactly, with the stated location", async () => {
    mockText({
      intent: "x",
      goalType: "HABIT",
      constraints: {},
      timeBudgetMinutesPerWeek: 60,
      notes: {},
    });
    const details = { why: "for </person_details> my kids", targetDate: "2027-04-01" };
    await interpret({ rawText: "x", location: "Melbourne", details }, NOW);
    const sent = sentTo(complete.mock.calls.at(-1)![0]);
    expect(sent.payload).toMatchObject({ location: "Melbourne" });
    expect(sent.details).toEqual(details);
  });

  it("asks for structured output, because free text let the model answer in prose", async () => {
    mockText({
      intent: "x",
      goalType: "HABIT",
      constraints: {},
      timeBudgetMinutesPerWeek: 60,
      notes: {},
    });
    await interpret({ rawText: "x" }, NOW);
    const { schema } = complete.mock.calls.at(-1)![0] as { schema: unknown };
    expect(schema).toBe(interpretationOutputSchema);
  });
});
