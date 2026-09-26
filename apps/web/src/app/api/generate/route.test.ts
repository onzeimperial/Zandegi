import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateMission = vi.fn();
vi.mock("@zandegi/ai", () => ({ generateMission: (...args: unknown[]) => generateMission(...args) }));

const { POST } = await import("./route");

function request(body: string, init: { headers?: Record<string, string>; signal?: AbortSignal } = {}) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    body,
    signal: init.signal,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

async function expectPublicError(response: Response, status: number, code: string, message: string) {
  expect(response.status).toBe(status);
  const body = (await response.json()) as {
    error: { code: string; message: string; requestId: string };
  };
  expect(body).toEqual({
    error: { code, message, requestId: expect.any(String) },
  });
  expect(body.error.requestId).toBe(response.headers.get("x-request-id"));
}

beforeEach(() => {
  generateMission.mockReset();
  generateMission.mockResolvedValue({ event: null, refusal: { reason: "narrow", route: "clarify" } });
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ENABLE_UNAUTHENTICATED_GENERATION", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/generate", () => {
  it("rejects the wrong media type, malformed JSON, oversized bodies, and unknown fields", async () => {
    const wrongType = await POST(request("{}", { headers: { "Content-Type": "text/plain" } }));
    await expectPublicError(wrongType, 415, "UNSUPPORTED_MEDIA_TYPE", "Send an application/json request.");

    const malformed = await POST(request("{"));
    await expectPublicError(malformed, 400, "INVALID_JSON", "Send a valid JSON body.");

    const oversized = await POST(request(JSON.stringify({ rawText: "x".repeat(17_000) })));
    await expectPublicError(oversized, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.");

    const unknown = await POST(request(JSON.stringify({ rawText: "run", extra: true })));
    await expectPublicError(unknown, 400, "INVALID_REQUEST", "The request fields are invalid.");
    expect(generateMission).not.toHaveBeenCalled();
  });

  it("rejects invalid field limits without starting the pipeline", async () => {
    for (const body of [
      { rawText: "" },
      { rawText: "x", weeklyTimeBudgetMinutes: 0 },
      { rawText: "x", weeklyTimeBudgetMinutes: Number.NaN },
      { rawText: "x", timezone: "not/a-zone" },
      { rawText: "x", location: "x".repeat(201) },
    ]) {
      const response = await POST(request(JSON.stringify(body)));
      await expectPublicError(response, 400, "INVALID_REQUEST", "The request fields are invalid.");
    }
    expect(generateMission).not.toHaveBeenCalled();
  });

  it("is disabled by default in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(request(JSON.stringify({ rawText: "run" })));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "GENERATION_DISABLED" } });
  });

  it("streams a result with a request ID when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_UNAUTHENTICATED_GENERATION", "true");
    const response = await POST(request(JSON.stringify({ rawText: "run" })));
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(text).toContain('"type":"result"');
    expect(generateMission).toHaveBeenCalledOnce();
  });

  it("never exposes a secret-bearing pipeline error", async () => {
    generateMission.mockRejectedValue(new Error("secret sk-ant-sensitive"));
    const response = await POST(request(JSON.stringify({ rawText: "run" })));
    const text = await response.text();
    expect(text).toContain("GENERATION_FAILED");
    expect(text).not.toContain("sk-ant-sensitive");
  });

  it("aborts active work at the deadline and emits a stable timeout", async () => {
    vi.useFakeTimers();
    try {
      let pipelineSignal: AbortSignal | undefined;
      generateMission.mockImplementation(
        (_input: unknown, _onEvent: unknown, options: { signal: AbortSignal }) => {
          pipelineSignal = options.signal;
          return new Promise(() => undefined);
        },
      );
      const response = await POST(request(JSON.stringify({ rawText: "run" })));
      await vi.advanceTimersByTimeAsync(25_000);
      const text = await response.text();
      expect(pipelineSignal?.aborted).toBe(true);
      expect(text).toContain("GENERATION_TIMEOUT");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not start generation for an already-aborted request", async () => {
    const client = new AbortController();
    client.abort();
    const response = await POST(request(JSON.stringify({ rawText: "run" }), { signal: client.signal }));
    await expect(response.text()).resolves.toBe("");
    expect(generateMission).not.toHaveBeenCalled();
  });

  it("preserves PAYLOAD_TOO_LARGE when cancelling the body rejects", async () => {
    const cancel = vi.fn().mockRejectedValue(new Error("cancel failed"));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(17_000));
      },
      cancel,
    });
    const oversizedRequest = new Request("http://localhost/api/generate", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await POST(oversizedRequest);
    await expectPublicError(response, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("aborts the exact pipeline signal when the client disconnects and writes nothing later", async () => {
    const client = new AbortController();
    let pipelineSignal: AbortSignal | undefined;
    generateMission.mockImplementation(
      (_input: unknown, _onEvent: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          pipelineSignal = options.signal;
          options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
        }),
    );

    const response = await POST(request(JSON.stringify({ rawText: "run" }), { signal: client.signal }));
    client.abort();
    await expect(response.text()).resolves.toBe("");
    expect(pipelineSignal?.aborted).toBe(true);
  });
});
