import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The adapter calls exactly one API-owned use case. Mocking it here proves
// that, and keeps the contract helpers (validation, error codes, ports) real.
const generateMission = vi.fn();
vi.mock("@zandegi/api", async () => {
  const actual = await vi.importActual<typeof import("@zandegi/api")>("@zandegi/api");
  return { ...actual, generateMission: (...args: unknown[]) => generateMission(...args) };
});

const { POST } = await import("./route");

const OWN_ORIGIN = "http://localhost";

// Every request carries a same-site `Origin` unless a test is specifically
// about the origin check: the route turns a cross-site caller away before it
// reads the body, so an omitted header would mask every other assertion.
function request(
  body: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    body,
    signal: init.signal,
    headers: { "Content-Type": "application/json", Origin: OWN_ORIGIN, ...init.headers },
  });
}

async function expectPublicError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
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
  generateMission.mockResolvedValue({
    outcome: "refusal",
    refusal: { reason: "narrow", route: "clarify" },
    meta: {
      runId: "run-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
      durationMs: 1_000,
    },
  });
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ENABLE_UNAUTHENTICATED_GENERATION", "");
  // No Upstash credentials: the route must work against the in-memory twin.
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("ZANDEGI_MISSION_STORE", "");
  vi.stubEnv("ZANDEGI_ALLOWED_ORIGINS", "");
  // Diagnostics are written to the server log, never to the response, so the
  // test output stays readable while the assertions below check the body.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/generate", () => {
  it("rejects the wrong media type, malformed JSON, oversized bodies, and unknown fields", async () => {
    const wrongType = await POST(request("{}", { headers: { "Content-Type": "text/plain" } }));
    await expectPublicError(
      wrongType,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send an application/json request.",
    );

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

  it("calls one API use case with the clock, id, cancellation and persistence ports", async () => {
    const response = await POST(request(JSON.stringify({ rawText: "run a half marathon" })));
    await response.text();

    expect(generateMission).toHaveBeenCalledOnce();
    const [input, ports] = generateMission.mock.calls[0] as [
      { request: unknown; principal: { id: string } },
      Record<string, unknown>,
    ];
    expect(input.request).toEqual({ rawText: "run a half marathon" });
    // The owner arrives as input. It is never read out of the body, and the
    // route resolved it from a server-held token hash before calling in.
    expect(typeof input.principal.id).toBe("string");
    expect(input.principal.id.length).toBeGreaterThan(0);
    expect(Object.keys(ports).sort()).toEqual([
      "cancellation",
      "clock",
      "ids",
      "knowledge",
      "persistence",
    ]);
    expect((ports.cancellation as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
    expect(typeof (ports.clock as { now: () => Date }).now()).toBe("object");
    expect(typeof (ports.ids as { newId: () => string }).newId()).toBe("string");
  });

  it("never exposes a secret-bearing pipeline error", async () => {
    generateMission.mockRejectedValue(new Error("secret sk-ant-sensitive"));
    const response = await POST(request(JSON.stringify({ rawText: "run" })));
    const text = await response.text();
    expect(text).toContain("GENERATION_FAILED");
    expect(text).not.toContain("sk-ant-sensitive");
  });

  it("emits only code, message and requestId for a GenerationError, keeping the diagnostic in the log", async () => {
    const { GenerationError } = await import("@zandegi/api");
    generateMission.mockRejectedValue(
      new GenerationError(
        "GENERATION_FAILED",
        "Error: detailChapter stage threw for chapter 2 at stages/05-detail.ts",
      ),
    );

    const response = await POST(request(JSON.stringify({ rawText: "run" })));
    const text = await response.text();

    const frames = text
      .split("\n\n")
      .filter((block) => block.startsWith("data:"))
      .map((block) => JSON.parse(block.slice(5).trim()) as { type: string; error?: unknown });
    const terminal = frames.at(-1);

    expect(terminal?.type).toBe("error");
    expect(Object.keys(terminal!.error as object).sort()).toEqual(["code", "message", "requestId"]);
    expect(terminal!.error).toEqual({
      code: "GENERATION_FAILED",
      message: "Mission generation failed. Try again.",
      requestId: response.headers.get("x-request-id"),
    });
    // The stage name and file path stay server-side.
    expect(text).not.toContain("detailChapter");
    expect(text).not.toContain("05-detail");
    // It is still written to the log an operator reads.
    expect(console.error).toHaveBeenCalledWith(
      "[generate]",
      expect.stringContaining("detailChapter"),
    );
  });

  it("logs a client disconnect as cancelled rather than as a generation failure", async () => {
    const client = new AbortController();
    generateMission.mockImplementation(
      (_input: unknown, ports: { cancellation: { signal: AbortSignal } }) =>
        new Promise((_resolve, reject) => {
          const { signal } = ports.cancellation;
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(
      request(JSON.stringify({ rawText: "run" }), { signal: client.signal }),
    );
    client.abort();
    await expect(response.text()).resolves.toBe("");

    expect(console.info).toHaveBeenCalledWith(
      "[generate]",
      expect.stringContaining('"outcome":"cancelled"'),
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("aborts active work at the deadline and emits a stable timeout", async () => {
    vi.useFakeTimers();
    try {
      let pipelineSignal: AbortSignal | undefined;
      generateMission.mockImplementation(
        (_input: unknown, ports: { cancellation: { signal: AbortSignal } }) => {
          pipelineSignal = ports.cancellation.signal;
          return new Promise(() => undefined);
        },
      );
      const response = await POST(request(JSON.stringify({ rawText: "run" })));
      await vi.advanceTimersByTimeAsync(60_000);
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
    const response = await POST(
      request(JSON.stringify({ rawText: "run" }), { signal: client.signal }),
    );
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
      headers: { "Content-Type": "application/json", Origin: OWN_ORIGIN },
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
      (_input: unknown, ports: { cancellation: { signal: AbortSignal } }) =>
        new Promise((_resolve, reject) => {
          const { signal } = ports.cancellation;
          pipelineSignal = signal;
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );

    const response = await POST(
      request(JSON.stringify({ rawText: "run" }), { signal: client.signal }),
    );
    client.abort();
    await expect(response.text()).resolves.toBe("");
    expect(pipelineSignal?.aborted).toBe(true);
  });
  it("rejects a cross-site or origin-less mutation before reading the body", async () => {
    for (const headers of [{ Origin: "https://evil.test" }, { Origin: "null" }]) {
      const response = await POST(request(JSON.stringify({ rawText: "run" }), { headers }));
      await expectPublicError(
        response,
        403,
        "CROSS_SITE_REQUEST",
        "This request did not come from Zandegi.",
      );
      // No stream, no model call, and no cookie: nothing was created.
      expect(response.headers.get("set-cookie")).toBeNull();
    }

    const noOrigin = new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ rawText: "run" }),
      headers: { "Content-Type": "application/json" },
    });
    await expectPublicError(
      await POST(noOrigin),
      403,
      "CROSS_SITE_REQUEST",
      "This request did not come from Zandegi.",
    );
    expect(generateMission).not.toHaveBeenCalled();
  });

  it("accepts an origin the configuration explicitly allows", async () => {
    vi.stubEnv("ZANDEGI_ALLOWED_ORIGINS", "https://preview.zandegi.app");
    const response = await POST(
      request(JSON.stringify({ rawText: "run" }), {
        headers: { Origin: "https://preview.zandegi.app" },
      }),
    );
    await response.text();
    expect(response.status).toBe(200);
    expect(generateMission).toHaveBeenCalledOnce();
  });

  it("sets an HttpOnly, same-site, explicitly expiring cookie on the streamed response", async () => {
    const response = await POST(request(JSON.stringify({ rawText: "run" })));
    const cookie = response.headers.get("set-cookie");

    // Written on the Response's headers, because once the body starts they
    // are gone and there is no cookies() mutation left to make.
    expect(cookie).toContain("zandegi_guest=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toMatch(/Expires=/);
    expect(await response.text()).toContain('"type":"result"');
  });

  it("resolves the same principal on a return visit", async () => {
    const first = await POST(request(JSON.stringify({ rawText: "run" })));
    await first.text();
    const cookie = first.headers.get("set-cookie")!.split(";", 1)[0]!;
    const firstPrincipal = (generateMission.mock.calls[0]![0] as { principal: { id: string } })
      .principal.id;

    const second = await POST(
      request(JSON.stringify({ rawText: "run again" }), { headers: { Cookie: cookie } }),
    );
    await second.text();
    const secondPrincipal = (generateMission.mock.calls[1]![0] as { principal: { id: string } })
      .principal.id;

    expect(secondPrincipal).toBe(firstPrincipal);
  });

  it.each([
    ["a tampered cookie", "zandegi_guest=not a token"],
    ["a well-formed token nothing matches", `zandegi_guest=${"z".repeat(43)}`],
  ])("mints a fresh principal for %s rather than erroring", async (_label, cookie) => {
    const response = await POST(
      request(JSON.stringify({ rawText: "run" }), { headers: { Cookie: cookie } }),
    );
    await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("zandegi_guest=");
    expect(generateMission).toHaveBeenCalledOnce();
  });

  it("creates no principal for a request that names its own owner", async () => {
    for (const body of [
      { rawText: "run", ownerId: "guest-9" },
      { rawText: "run", missionId: "mission-9" },
      { rawText: "run", principal: { id: "guest-9" } },
    ]) {
      const response = await POST(request(JSON.stringify(body)));
      await expectPublicError(response, 400, "INVALID_REQUEST", "The request fields are invalid.");
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(generateMission).not.toHaveBeenCalled();
  });

  it("fails closed with a safe error when the configured store cannot be reached", async () => {
    vi.stubEnv("ZANDEGI_MISSION_STORE", "redis");
    const response = await POST(request(JSON.stringify({ rawText: "run" })));

    const text = await response.clone().text();
    await expectPublicError(
      response,
      503,
      "STORE_UNAVAILABLE",
      "Your missions are temporarily unavailable. Try again.",
    );
    // The credentials and the endpoint stay out of the client's answer.
    expect(text.toLowerCase()).not.toContain("upstash");
    expect(generateMission).not.toHaveBeenCalled();
  });
});
