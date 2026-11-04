import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ create: vi.fn(), parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class AnthropicMock {
    messages = { create: mocks.create, parse: mocks.parse };
  },
}));

const { complete, structuredOutputFormat } = await import("./router");
const { ModelOutputError, detailChapterOutputSchema, planOutputSchema } = await import("./schemas");

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

// These run against the real SDK helper on purpose. SDK 0.131.0 moves `enum`
// into the description, so the API never enforced it, and a real run lost a
// whole mission to one out-of-set `verification`. An SDK upgrade must not be able
// to bring that back quietly.
describe("structuredOutputFormat", () => {
  const VERIFICATION = ["SELF", "TIMER", "ARTIFACT", "METRIC", "INTEGRATION"];

  function stepSchema(): Record<string, Record<string, unknown>> {
    const { schema } = structuredOutputFormat(detailChapterOutputSchema);
    const defs = schema.$defs as Record<
      string,
      { properties: Record<string, Record<string, unknown>> }
    >;
    return Object.values(defs)[0]!.properties;
  }

  it("sends the detail stage's verification as an enforced enum", () => {
    expect(stepSchema().verification).toEqual({ type: "string", enum: VERIFICATION });
  });

  it("sends the plan stage's domain as an enforced enum", () => {
    const { schema } = structuredOutputFormat(planOutputSchema);
    const properties = schema.properties as Record<string, { enum?: unknown[] }>;
    expect(properties.primaryDomain?.enum).toContain("Body");
  });

  it("leaves no closed set behind as description text in any stage schema", () => {
    for (const schema of [detailChapterOutputSchema, planOutputSchema]) {
      expect(JSON.stringify(structuredOutputFormat(schema).schema)).not.toMatch(/\{(enum|const):/);
    }
  });

  it("restores a closed set wherever it sits in the schema", () => {
    const schema = z.object({
      nested: z.object({ picked: z.enum(["a", "b"]) }),
      list: z.array(z.enum(["c"])),
      maybe: z.enum(["d"]).nullable(),
      fixed: z.literal("e"),
    });
    const sent = JSON.stringify(structuredOutputFormat(schema).schema);
    for (const fragment of ['"enum":["a","b"]', '"enum":["c"]', '"enum":["d"]', '"const":"e"']) {
      expect(sent).toContain(fragment);
    }
  });

  it("keeps a field's own description when it restores the closed set", () => {
    const schema = z.object({ picked: z.enum(["a"]).describe("Which one") });
    const { schema: sent } = structuredOutputFormat(schema);
    const properties = sent.properties as Record<string, unknown>;
    expect(properties.picked).toEqual({ type: "string", enum: ["a"], description: "Which one" });
  });
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

    // Never `parse`: it validates before returning, which would bypass the
    // stop-reason checks and report a truncation as a parse failure.
    expect(mocks.parse).not.toHaveBeenCalled();
    const [body] = mocks.create.mock.calls[0]! as [{ output_config?: Record<string, unknown> }];
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

  it("reports a truncated structured response as truncated, not as a parse failure", async () => {
    mocks.create.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"steps": [{"title": "unfinish' }],
      stop_reason: "max_tokens",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const failure = await complete({
      stage: "detail",
      system: "system",
      user: "user",
      schema: detailChapterOutputSchema,
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ModelOutputError);
    expect((failure as InstanceType<typeof ModelOutputError>).kind).toBe("truncated");
  });

  it("passes the exact AbortSignal to the Anthropic request options", async () => {
    const controller = new AbortController();
    await complete({ stage: "safety", system: "system", user: "user", signal: controller.signal });
    expect(mocks.create).toHaveBeenCalledWith(expect.any(Object), { signal: controller.signal });
  });
});
