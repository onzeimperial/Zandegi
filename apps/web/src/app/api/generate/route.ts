/**
 * The web adapter for mission generation.
 *
 * It owns transport and nothing else: media type, a bounded body, SSE
 * framing, the application deadline and client disconnects. Orchestration
 * belongs to `@zandegi/api`'s use case, which this route calls exactly once
 * with its ports injected (AD-2). The use case is invoked in-process rather
 * than over tRPC, because generation is a long streamed response.
 */

import {
  GENERATION_ERROR_MESSAGES,
  GenerationError,
  cancellationFrom,
  emptyKnowledge,
  generateMission,
  generationErrorBody,
  noopGenerationPersistence,
  parseGenerateMissionRequest,
  randomIdGenerator,
  systemClock,
  type GenerateMissionRequest,
  type GenerationErrorCode,
  type GenerationProgress,
} from "@zandegi/api";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const GENERATION_TIMEOUT_MS = 25_000;

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

  // The field rules live with the contract in `@zandegi/api`, so the adapter
  // and the use case cannot drift. A bad request is answered as a non-2xx JSON
  // body before any stream is opened and before any model call.
  let request: GenerateMissionRequest;
  try {
    request = parseGenerateMissionRequest(await readBoundedJson(req));
  } catch (error) {
    if (error instanceof RequestFailure) return jsonError(error.status, error.code, requestId);
    if (error instanceof GenerationError) return jsonError(400, error.code, requestId);
    return jsonError(400, "INVALID_REQUEST", requestId);
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
            onProgress: (event: GenerationProgress) => {
              if (!abortController.signal.aborted) send({ type: "progress", event });
            },
          },
          {
            clock: systemClock,
            ids: randomIdGenerator,
            cancellation: cancellationFrom(abortController.signal),
            knowledge: emptyKnowledge,
            persistence: noopGenerationPersistence,
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
    },
  });
}
