/**
 * The web adapter for mission generation.
 *
 * It owns transport and nothing else: media type, a bounded body, SSE
 * framing, the application deadline and client disconnects. Orchestration
 * belongs to `@zandegi/api`'s use case, which this route calls exactly once
 * with its ports injected (AD-2). The use case is invoked in-process rather
 * than over tRPC, because generation is a long streamed response.
 *
 * The order of the checks below is the security design, not an accident:
 *
 *   1. the feature gate, so a production deploy that has not opted in serves
 *      nothing;
 *   2. the origin check, so a cross-site caller is turned away before the body
 *      is read, before a principal exists, and long before a model call;
 *   3. the body, so a request that names its own owner is rejected as an
 *      unknown field before any identity is created;
 *   4. the guest principal, whose `Set-Cookie` must be written onto the
 *      `Response` this function constructs — once the stream's body starts,
 *      the headers are gone and there is no `cookies()` mutation left to make.
 */

import {
  GENERATION_ERROR_MESSAGES,
  GenerationError,
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  trustsForwardedOrigin,
  cancellationFrom,
  demoPortsFromEnv,
  emptyKnowledge,
  generateMission,
  generationErrorBody,
  guestCookiePolicyFromEnv,
  parseGenerateMissionRequest,
  randomIdGenerator,
  randomTokenSource,
  resolveOrMintGuest,
  sha256TokenHasher,
  systemClock,
  type GenerateMissionRequest,
  type GenerationErrorCode,
  type GenerationProgress,
  type GuestSession,
  type ModelOutputRejection,
} from "@zandegi/api";

import { recordIncident } from "./incidents";

export const runtime = "nodejs";

/**
 * The host's limit for this function, in seconds. It must stay above the
 * application deadline below: if the platform killed the function first, the
 * client would get a raw platform error instead of the stable
 * GENERATION_TIMEOUT frame (AD-8: the application deadline is shorter than the
 * host deadline).
 */
export const maxDuration = 150;

const MAX_BODY_BYTES = 16 * 1024;
/**
 * Measured on real generations: plan and the first stages take about 6s, one
 * chapter of detail 18-22s at low effort, and a 6-7 chapter mission needs two
 * waves of four, then a grounding rewrite pass. Real missions landed at 56s,
 * 64s and 68s -- straddling a 60s deadline, so some failed after being paid
 * for. 120s sits clear of every observed run. NFR1's p95 target of 25s is not
 * achievable with rich chapter detail on the current model; this is a
 * recorded, deliberate deviation for the demo.
 */
const GENERATION_TIMEOUT_MS = 120_000;

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: GenerationErrorCode,
  ) {
    super(GENERATION_ERROR_MESSAGES[code]);
  }
}

function errorBody(code: GenerationErrorCode, requestId: string) {
  return generationErrorBody(code, requestId);
}

function jsonError(status: number, code: GenerationErrorCode, requestId: string): Response {
  return Response.json(errorBody(code, requestId), {
    status,
    headers: { "X-Request-Id": requestId },
  });
}

/** Server-only. The client gets a stable code; the detail stops here. */
function logDiagnostic(requestId: string, code: GenerationErrorCode, diagnostic: string): void {
  console.error("[generate]", JSON.stringify({ requestId, code, diagnostic }));
  recordIncident({ event: "generation_failed", requestId, code, diagnostic });
}

/**
 * A warning, not an error, while a retry is still to come: the request may yet
 * succeed. It is recorded either way, because a stage that needs its retry on
 * every run is a problem no user will ever report.
 */
function logRejection(requestId: string, rejection: ModelOutputRejection): void {
  const entry = { event: "model_output_rejected", requestId, ...rejection };
  (rejection.willRetry ? console.warn : console.error)("[generate]", JSON.stringify(entry));
  recordIncident(entry);
}

/**
 * Server-only, and deliberately not an error: the client went away, the run
 * aborted, and no terminal result was delivered. That is the expected path,
 * so it is logged as information rather than under a failure code.
 */
function logCancelled(requestId: string): void {
  console.info("[generate]", JSON.stringify({ requestId, outcome: "cancelled" }));
}

async function readBoundedJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestFailure(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isFinite(parsed) || parsed < 0) throw new RequestFailure(400, "INVALID_REQUEST");
    if (parsed > MAX_BODY_BYTES) throw new RequestFailure(413, "PAYLOAD_TOO_LARGE");
  }

  if (!req.body) throw new RequestFailure(400, "INVALID_JSON");
  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new RequestFailure(413, "PAYLOAD_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure(400, "INVALID_JSON");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_UNAUTHENTICATED_GENERATION !== "true"
  ) {
    return jsonError(503, "GENERATION_DISABLED", requestId);
  }

  // Step 2. `SameSite=Lax` already keeps the cookie off a cross-site form
  // post, but that is the browser's rule, not ours. This one is ours.
  try {
    assertSameSiteRequest({
      origin: req.headers.get("origin"),
      requestUrl: req.url,
      allowedOrigins: allowedOriginsFromEnv(process.env.ZANDEGI_ALLOWED_ORIGINS),
      // Behind a proxy the request URL carries the internal host, which would
      // reject every legitimate call. These headers are read only when the
      // platform itself vouches for them.
      forwardedHost: req.headers.get("x-forwarded-host"),
      forwardedProto: req.headers.get("x-forwarded-proto"),
      trustForwarded: trustsForwardedOrigin(process.env.VERCEL),
    });
  } catch {
    return jsonError(403, "CROSS_SITE_REQUEST", requestId);
  }

  // Step 3. The field rules live with the contract in `@zandegi/api`, so the
  // adapter and the use case cannot drift. A bad request is answered as a
  // non-2xx JSON body before any stream is opened and before any model call.
  let request: GenerateMissionRequest;
  try {
    request = parseGenerateMissionRequest(await readBoundedJson(req));
  } catch (error) {
    if (error instanceof RequestFailure) return jsonError(error.status, error.code, requestId);
    if (error instanceof GenerationError) return jsonError(400, error.code, requestId);
    return jsonError(400, "INVALID_REQUEST", requestId);
  }

  // Step 4. A cookie we cannot resolve — tampered, unknown or expired — mints
  // a fresh principal rather than surfacing an error, because there is no
  // recovery action an anonymous visitor could take and saying so would only
  // confirm the server recognised something.
  let guest: GuestSession;
  let persistence;
  try {
    const ports = await demoPortsFromEnv();
    persistence = ports.persistence;
    guest = await resolveOrMintGuest(
      req.headers.get("cookie"),
      guestCookiePolicyFromEnv(process.env),
      {
        clock: systemClock,
        ids: randomIdGenerator,
        tokens: randomTokenSource,
        hasher: sha256TokenHasher,
        guests: ports.guests,
      },
    );
  } catch (error) {
    logDiagnostic(
      requestId,
      "STORE_UNAVAILABLE",
      error instanceof GenerationError ? error.diagnostic : "identity store unreachable",
    );
    return jsonError(503, "STORE_UNAVAILABLE", requestId);
  }

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let disconnected = req.signal.aborted;
  let timedOut = false;
  const onDisconnect = () => {
    disconnected = true;
    abortController.abort(new DOMException("Client disconnected", "AbortError"));
    try {
      streamController?.close();
    } catch {
      // The consumer may already have cancelled the stream.
    }
  };
  if (req.signal.aborted) onDisconnect();
  else req.signal.addEventListener("abort", onDisconnect, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;
      if (disconnected) {
        controller.close();
        return;
      }
      let closed = false;
      const send = (data: unknown): boolean => {
        if (closed || disconnected) return false;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          return true;
        } catch {
          disconnected = true;
          abortController.abort(new DOMException("Client disconnected", "AbortError"));
          return false;
        }
      };
      let timeout: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          timedOut = true;
          const reason = new DOMException("Generation timed out", "TimeoutError");
          abortController.abort(reason);
          reject(reason);
        }, GENERATION_TIMEOUT_MS);
      });

      try {
        const generation = generateMission(
          {
            request,
            principal: guest.principal,
            onProgress: (event: GenerationProgress) => {
              if (!abortController.signal.aborted) send({ type: "progress", event });
            },
          },
          {
            clock: systemClock,
            ids: randomIdGenerator,
            cancellation: cancellationFrom(abortController.signal),
            knowledge: emptyKnowledge,
            persistence,
            onOutputRejected: (rejection) => logRejection(requestId, rejection),
          },
        );
        const result = await Promise.race([generation, deadline]);
        if (!abortController.signal.aborted) send({ type: "result", result, requestId });
      } catch (error) {
        if (!disconnected) {
          const code: GenerationErrorCode = timedOut
            ? "GENERATION_TIMEOUT"
            : error instanceof GenerationError
              ? error.code
              : "GENERATION_FAILED";
          logDiagnostic(
            requestId,
            code,
            error instanceof GenerationError ? error.diagnostic : "non-api failure",
          );
          send({ type: "error", error: errorBody(code, requestId).error });
        } else {
          // A disconnect is not a failure. It must not be logged under an
          // error code, or every closed tab reads as a broken generation in
          // the log an operator inspects.
          logCancelled(requestId);
        }
      } finally {
        clearTimeout(timeout!);
        req.signal.removeEventListener("abort", onDisconnect);
        if (!closed && !disconnected) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      disconnected = true;
      abortController.abort(new DOMException("Client disconnected", "AbortError"));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
      // Written here because this is the last moment it can be: the stream's
      // body starts the instant this Response is returned.
      "Set-Cookie": guest.setCookie,
    },
  });
}
