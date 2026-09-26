/** Strict, bounded SSE adapter for the temporary unauthenticated demo. */

import { generateMission, type GoalInput, type StageEvent } from "@zandegi/ai";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_GOAL_LENGTH = 2_000;
const MAX_LOCATION_LENGTH = 200;
const MAX_TIMEZONE_LENGTH = 100;
const GENERATION_TIMEOUT_MS = 25_000;
const INPUT_FIELDS = new Set(["rawText", "weeklyTimeBudgetMinutes", "timezone", "location"]);

type ErrorCode =
  | "GENERATION_DISABLED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "GENERATION_TIMEOUT"
  | "GENERATION_FAILED";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  GENERATION_DISABLED: "Mission generation is unavailable.",
  UNSUPPORTED_MEDIA_TYPE: "Send an application/json request.",
  PAYLOAD_TOO_LARGE: "The request body is too large.",
  INVALID_JSON: "Send a valid JSON body.",
  INVALID_REQUEST: "The request fields are invalid.",
  GENERATION_TIMEOUT: "Mission generation timed out. Try again.",
  GENERATION_FAILED: "Mission generation failed. Try again.",
};

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
  ) {
    super(ERROR_MESSAGES[code]);
  }
}

function errorBody(code: ErrorCode, requestId: string) {
  return { error: { code, message: ERROR_MESSAGES[code], requestId } };
}

function jsonError(status: number, code: ErrorCode, requestId: string): Response {
  return Response.json(errorBody(code, requestId), {
    status,
    headers: { "X-Request-Id": requestId },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function validateInput(body: unknown): GoalInput {
  if (!isRecord(body) || Object.keys(body).some((key) => !INPUT_FIELDS.has(key))) {
    throw new RequestFailure(400, "INVALID_REQUEST");
  }
  if (
    typeof body.rawText !== "string" ||
    body.rawText.trim().length === 0 ||
    body.rawText.length > MAX_GOAL_LENGTH
  ) {
    throw new RequestFailure(400, "INVALID_REQUEST");
  }

  if (
    body.weeklyTimeBudgetMinutes !== undefined &&
    (typeof body.weeklyTimeBudgetMinutes !== "number" ||
      !Number.isInteger(body.weeklyTimeBudgetMinutes) ||
      body.weeklyTimeBudgetMinutes < 1 ||
      body.weeklyTimeBudgetMinutes > 10_080)
  ) {
    throw new RequestFailure(400, "INVALID_REQUEST");
  }
  if (
    body.location !== undefined &&
    (typeof body.location !== "string" ||
      body.location.trim().length === 0 ||
      body.location.length > MAX_LOCATION_LENGTH)
  ) {
    throw new RequestFailure(400, "INVALID_REQUEST");
  }
  if (
    body.timezone !== undefined &&
    (typeof body.timezone !== "string" ||
      body.timezone.length === 0 ||
      body.timezone.length > MAX_TIMEZONE_LENGTH)
  ) {
    throw new RequestFailure(400, "INVALID_REQUEST");
  }
  if (typeof body.timezone === "string") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone });
    } catch {
      throw new RequestFailure(400, "INVALID_REQUEST");
    }
  }

  return {
    rawText: body.rawText,
    weeklyTimeBudgetMinutes: body.weeklyTimeBudgetMinutes as number | undefined,
    timezone: body.timezone as string | undefined,
    location: body.location as string | undefined,
  };
}

function publicProgress(event: StageEvent): StageEvent {
  return event.status === "error" ? { stage: event.stage, status: "error" } : event;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_UNAUTHENTICATED_GENERATION !== "true"
  ) {
    return jsonError(503, "GENERATION_DISABLED", requestId);
  }

  let input: GoalInput;
  try {
    input = validateInput(await readBoundedJson(req));
  } catch (error) {
    if (error instanceof RequestFailure) return jsonError(error.status, error.code, requestId);
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
          input,
          (event) => {
            if (!abortController.signal.aborted) send({ type: "progress", event: publicProgress(event) });
          },
          { signal: abortController.signal },
        );
        const result = await Promise.race([generation, deadline]);
        if (!abortController.signal.aborted) send({ type: "result", result, requestId });
      } catch {
        if (!disconnected) {
          const code: ErrorCode = timedOut ? "GENERATION_TIMEOUT" : "GENERATION_FAILED";
          send({ type: "error", error: errorBody(code, requestId).error });
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
