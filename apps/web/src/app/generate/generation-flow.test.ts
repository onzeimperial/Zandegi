import { describe, expect, it, vi } from "vitest";
import { runGeneration, type GenerationFetch } from "./generation-flow";

const encoder = new TextEncoder();
function response(...messages: unknown[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const message of messages)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const META = {
  runId: "run-1",
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:01.000Z",
  durationMs: 1_000,
};

describe("generation orchestration", () => {
  it("forwards progress and returns a refusal terminal", async () => {
    const progress = vi.fn();
    const refusal = {
      outcome: "refusal" as const,
      refusal: { reason: "Narrow it", route: "clarify" as const },
      meta: META,
    };
    const fetcher = vi
      .fn<GenerationFetch>()
      .mockResolvedValue(
        response(
          { type: "progress", event: { stage: "hydrate", status: "start", detail: "Checking" } },
          { type: "result", result: refusal, requestId: "r1" },
        ),
      );
    await expect(
      runGeneration({ rawText: "goal" }, new AbortController().signal, progress, fetcher),
    ).resolves.toEqual(refusal);
    expect(progress).toHaveBeenCalledWith({
      stage: "hydrate",
      status: "start",
      detail: "Checking",
    });
  });
  it("returns a generated mission result terminal", async () => {
    const result = {
      outcome: "mission" as const,
      mission: { title: "Mission", goalType: "METRIC", primaryDomain: "Mind", chapters: [] },
      safety: { safetyClass: "NORMAL", professionalFrameApplied: false },
      grounding: { claimsChecked: 0, ungroundedClaims: 0, rewritten: 0, dropped: 0 },
      meta: META,
    };
    const fetcher = vi
      .fn<GenerationFetch>()
      .mockResolvedValue(response({ type: "result", result, requestId: "r-result" }));
    await expect(
      runGeneration({ rawText: "goal" }, new AbortController().signal, vi.fn(), fetcher),
    ).resolves.toEqual(result);
  });
  it("surfaces SSE and HTTP errors for the page error state", async () => {
    const streamError = vi.fn<GenerationFetch>().mockResolvedValue(
      response({
        type: "error",
        error: { code: "FAILED", message: "Try again", requestId: "r2" },
      }),
    );
    await expect(
      runGeneration({ rawText: "goal" }, new AbortController().signal, vi.fn(), streamError),
    ).rejects.toThrow("Try again");
    const httpError = vi
      .fn<GenerationFetch>()
      .mockResolvedValue(Response.json({ error: { message: "Unavailable" } }, { status: 503 }));
    await expect(
      runGeneration({ rawText: "goal" }, new AbortController().signal, vi.fn(), httpError),
    ).rejects.toThrow("Unavailable");
  });
  it("keeps the stable code from an HTTP refusal, so the screen can answer it", async () => {
    const limited = vi
      .fn<GenerationFetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: "DAILY_LIMIT_REACHED", message: "Tomorrow", requestId: "r3" } },
          { status: 429 },
        ),
      );
    await expect(
      runGeneration({ rawText: "goal" }, new AbortController().signal, vi.fn(), limited),
    ).rejects.toMatchObject({ code: "DAILY_LIMIT_REACHED", requestId: "r3" });
  });
  it("passes abort through to active work", async () => {
    const controller = new AbortController();
    const fetcher: GenerationFetch = (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        ),
      );
    const pending = runGeneration({ rawText: "goal" }, controller.signal, vi.fn(), fetcher);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
