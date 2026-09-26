import type { PipelineResult, StageEvent } from "@zandegi/ai";

export interface PublicStreamError {
  code: string;
  message: string;
  requestId: string;
}

type SseMessage =
  | { type: "progress"; event: StageEvent }
  | { type: "result"; result: PipelineResult; requestId: string }
  | { type: "error"; error: PublicStreamError };

const STAGES = new Set([
  "interpret",
  "resolve",
  "hydrate",
  "plan",
  "detail",
  "ground",
  "score",
  "safety",
  "persist",
]);
const STATUSES = new Set(["start", "done", "error"]);

export class GenerationStreamError extends Error {
  constructor(
    message: string,
    readonly code = "INVALID_STREAM",
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "GenerationStreamError";
  }
}

function invalidStream(): GenerationStreamError {
  return new GenerationStreamError("The generation stream was invalid.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStageEvent(value: unknown): value is StageEvent {
  if (!isRecord(value) || typeof value.stage !== "string" || typeof value.status !== "string") {
    return false;
  }
  if (!STAGES.has(value.stage) || !STATUSES.has(value.status)) return false;
  if (value.detail !== undefined && typeof value.detail !== "string") return false;
  return value.chapter === undefined || isRecord(value.chapter);
}

function isRefusal(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.reason === "string" &&
    (value.route === "support" || value.route === "clarify")
  );
}

function isMissionGeneratedEvent(value: unknown): boolean {
  if (!isRecord(value) || value.type !== "MissionGenerated" || !isRecord(value.payload)) return false;
  const mission = value.payload.mission;
  const safety = value.payload.safety;
  return (
    isRecord(mission) &&
    typeof mission.title === "string" &&
    typeof mission.primaryDomain === "string" &&
    typeof mission.completionXp === "number" &&
    Number.isFinite(mission.completionXp) &&
    Array.isArray(mission.chapters) &&
    isRecord(safety) &&
    typeof safety.professionalFrameApplied === "boolean"
  );
}

function isPipelineResult(value: unknown): value is PipelineResult {
  if (!isRecord(value)) return false;
  if (value.event === null) return isRefusal(value.refusal);
  return isMissionGeneratedEvent(value.event) && value.refusal === undefined;
}

function parseMessage(value: unknown): SseMessage {
  if (!isRecord(value) || typeof value.type !== "string") throw invalidStream();
  if (value.type === "progress" && isStageEvent(value.event)) {
    return { type: "progress", event: value.event };
  }
  if (
    value.type === "result" &&
    isPipelineResult(value.result) &&
    typeof value.requestId === "string"
  ) {
    return { type: "result", result: value.result, requestId: value.requestId };
  }
  if (
    value.type === "error" &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string" &&
    typeof value.error.requestId === "string"
  ) {
    return {
      type: "error",
      error: {
        code: value.error.code,
        message: value.error.message,
        requestId: value.error.requestId,
      },
    };
  }
  throw invalidStream();
}

function parseBlock(block: string): SseMessage | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  try {
    return parseMessage(JSON.parse(data) as unknown);
  } catch (error) {
    if (error instanceof GenerationStreamError) throw error;
    throw invalidStream();
  }
}

function normalizeNewlines(value: string, final: boolean): string {
  const holdsTrailingCarriageReturn = !final && value.endsWith("\r");
  const complete = holdsTrailingCarriageReturn ? value.slice(0, -1) : value;
  return (
    complete.replace(/\r\n/g, "\n").replace(/\r/g, "\n") +
    (holdsTrailingCarriageReturn ? "\r" : "")
  );
}

export async function consumeGenerationStream(
  stream: ReadableStream<Uint8Array>,
  onProgress: (event: StageEvent) => void,
): Promise<PipelineResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: PipelineResult | undefined;

  const consumeBlock = (block: string) => {
    const message = parseBlock(block);
    if (!message) return;
    if (terminal !== undefined) {
      throw new GenerationStreamError("The generation stream had multiple terminal messages.");
    }
    if (message.type === "progress") onProgress(message.event);
    else if (message.type === "result") terminal = message.result;
    else {
      throw new GenerationStreamError(message.error.message, message.error.code, message.error.requestId);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = normalizeNewlines(buffer + decoder.decode(value, { stream: true }), false);
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) consumeBlock(block);
    }
    buffer = normalizeNewlines(buffer + decoder.decode(), true);
    if (buffer.trim()) consumeBlock(buffer);

    if (terminal === undefined) {
      throw new GenerationStreamError("Generation ended before a result arrived.", "PREMATURE_EOF");
    }
    return terminal;
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // The original stream failure is authoritative.
    }
    if (error instanceof GenerationStreamError) throw error;
    throw invalidStream();
  } finally {
    reader.releaseLock();
  }
}
