import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ create: vi.fn(), parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class AnthropicMock {
    messages = { create: mocks.create, parse: mocks.parse };
  },
}));

const { complete } = await import("./router");

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.create.mockReset();
  mocks.parse.mockReset();
  for (const mock of [mocks.create, mocks.parse]) {
    mock.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  }
});

describe("complete", () => {
  // A real 400 from the API: `temperature` is deprecated for this model. Sonnet 5
  // and the Opus 5 family reject sampling params outright, so the router must not
  // send them -- and the two Haiku stages must keep theirs.
  it("omits temperature for the tiers whose models reject it", async () => {
    for (const stage of ["plan", "detail"] as const) {
      mocks.create.mockClear();
      await complete({ stage, system: "system", user: "user", temperature: 0.5 });
      const [body] = mocks.create.mock.calls[0]!;
      expect(Object.keys(body as object), stage).not.toContain("temperature");
    }
  });

  it("still sends temperature where the model accepts it", async () => {
    for (const stage of ["interpret", "resolve"] as const) {
      mocks.create.mockClear();
      await complete({ stage, system: "system", user: "user", temperature: 0.2 });
      const [body] = mocks.create.mock.calls[0]! as [{ temperature?: number }];
      expect(body.temperature, stage).toBe(0.2);
    }
  });

  it("constrains output to the schema when one is given, so malformed JSON cannot occur", async () => {
    const schema = z.object({ title: z.string() });
    await complete({ stage: "detail", system: "system", user: "user", schema });

    expect(mocks.create).not.toHaveBeenCalled();
    const [body] = mocks.parse.mock.calls[0]! as [{ output_config?: Record<string, unknown> }];
    expect(body.output_config?.format).toBeDefined();
    // Effort survives alongside the format rather than being overwritten by it.
    expect(body.output_config?.effort).toBe("low");
  });

  it("sends no effort to the fast tier, which rejects it", async () => {
    await complete({ stage: "interpret", system: "system", user: "user" });
    const [body] = mocks.create.mock.calls[0]! as [Record<string, unknown>];
    expect(body).not.toHaveProperty("output_config");
  });

  it("refuses to hand back a response cut off at the token budget", async () => {
    mocks.create.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"steps": [{"title": "unfinish' }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    await expect(
      complete({ stage: "plan", system: "system", user: "user", maxTokens: 10 }),
    ).rejects.toThrow(/truncated at max_tokens=10/);
  });

  it("passes the exact AbortSignal to the Anthropic request options", async () => {
    const controller = new AbortController();
    await complete({ stage: "safety", system: "system", user: "user", signal: controller.signal });
    expect(mocks.create).toHaveBeenCalledWith(expect.any(Object), { signal: controller.signal });
  });
});
