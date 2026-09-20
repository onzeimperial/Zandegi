import { describe, it, expect, vi } from "vitest";

const complete = vi.fn();
vi.mock("../router", () => ({ complete: (...args: unknown[]) => complete(...args) }));

const { interpret } = await import("./01-interpret");

function mockText(obj: unknown) {
  complete.mockResolvedValueOnce({ text: JSON.stringify(obj), model: "test", usage: { inputTokens: 0, outputTokens: 0 } });
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
    const result = await interpret({ rawText: "run a half marathon in april" });
    expect(result.goalType).toBe("METRIC");
    expect(result.pursuitMatches).toEqual([]);
  });

  it("strips a markdown fence if the model adds one", async () => {
    complete.mockResolvedValueOnce({
      text: "```json\n" + JSON.stringify({
        intent: "x",
        goalType: "HABIT",
        constraints: {},
        timeBudgetMinutesPerWeek: 60,
        notes: {},
      }) + "\n```",
      model: "test",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const result = await interpret({ rawText: "meditate daily" });
    expect(result.goalType).toBe("HABIT");
  });

  it("throws a clear error on invalid JSON", async () => {
    mockText("not json");
    complete.mockReset();
    complete.mockResolvedValueOnce({ text: "not valid json{", model: "test", usage: { inputTokens: 0, outputTokens: 0 } });
    await expect(interpret({ rawText: "x" })).rejects.toThrow(/\[interpret\]/);
  });

  it("throws on schema violation (missing required field)", async () => {
    mockText({ intent: "x" });
    await expect(interpret({ rawText: "x" })).rejects.toThrow(/\[interpret\]/);
  });

  it("flags impossible scope when the model says so", async () => {
    mockText({
      intent: "Become a billionaire",
      goalType: "METRIC",
      constraints: {},
      timeBudgetMinutesPerWeek: 180,
      notes: { isImpossibleScope: true },
    });
    const result = await interpret({ rawText: "become a billionaire by march" });
    expect(result.notes.isImpossibleScope).toBe(true);
  });
});
