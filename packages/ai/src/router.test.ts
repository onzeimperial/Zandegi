import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class AnthropicMock {
    messages = { create: mocks.create };
  },
}));

const { complete } = await import("./router");

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  mocks.create.mockReset();
  mocks.create.mockResolvedValue({
    content: [{ type: "text", text: "ok" }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });
});

describe("complete", () => {
  it("passes the exact AbortSignal to the Anthropic request options", async () => {
    const controller = new AbortController();
    await complete({ stage: "safety", system: "system", user: "user", signal: controller.signal });
    expect(mocks.create).toHaveBeenCalledWith(expect.any(Object), { signal: controller.signal });
  });
});
