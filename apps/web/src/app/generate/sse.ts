import {
  GENERATION_REFUSAL_ROUTES,
  isGenerationStage,
  isGenerationStageStatus,
  type GenerationProgress,
  type GenerationResult,
  type MissionChapter,
} from "@zandegi/api/client";

export interface PublicStreamError {
  code: string;
  message: string;
  requestId: string;
}

type SseMessage =
  | { type: "progress"; event: GenerationProgress }
  | { type: "result"; result: GenerationResult; requestId: string }
  | { type: "error"; error: PublicStreamError };

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

function isChapter(value: unknown): value is MissionChapter {
  return (
    isRecord(value) &&
    typeof value.index === "number" &&
    typeof value.title === "string" &&
    typeof value.exitCondition === "string" &&
    Array.isArray(value.steps)
  );
}

function isProgress(value: unknown): value is GenerationProgress {
  if (!isRecord(value) || !isGenerationStage(value.stage) || !isGenerationStageStatus(value.status))
    return false;
  if (value.detail !== undefined && typeof value.detail !== "string") return false;
  return value.chapter === undefined || isChapter(value.chapter);
}

function isRunMeta(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs)
  );
}

function isMissionOutcome(value: Record<string, unknown>): boolean {
  const mission = value.mission;
  const safety = value.safety;
  return (
    isRecord(mission) &&
    typeof mission.title === "string" &&
    typeof mission.goalType === "string" &&
    typeof mission.primaryDomain === "string" &&
    Array.isArray(mission.chapters) &&
    mission.chapters.every(isChapter) &&
    isRecord(safety) &&
    typeof safety.professionalFrameApplied === "boolean"
  );
}

function isRefusalOutcome(value: Record<string, unknown>): boolean {
  const refusal = value.refusal;
  return (
    isRecord(refusal) &&
    typeof refusal.reason === "string" &&
    (GENERATION_REFUSAL_ROUTES as readonly unknown[]).includes(refusal.route)
  );
}

/**
 * The terminal frame is one of exactly two shapes. There is deliberately no
 * XP, rarity or difficulty field to validate: generation promises no
 * progression number, so a frame carrying one is not a frame we understand.
 */
function isGenerationResult(value: unknown): value is GenerationResult {
  if (!isRecord(value) || !isRunMeta(value.meta)) return false;
  if (value.outcome === "mission") return isMissionOutcome(value);
  if (value.outcome === "refusal") return isRefusalOutcome(value);
  return false;
}

function parseMessage(value: unknown): SseMessage {
  if (!isRecord(value) || typeof value.type !== "string") throw invalidStream();
  if (value.type === "progress" && isProgress(value.event)) {
    return { type: "progress", event: value.event };
  }
  if (
    value.type === "result" &&
    isGenerationResult(value.result) &&
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
    complete.replace(/\r\n/g, "\n").replace(/\r/g, "\n") + (holdsTrailingCarriageReturn ? "\r" : "")
  );
}

export async function consumeGenerationStream(
  stream: ReadableStream<Uint8Array>,
  onProgress: (event: GenerationProgress) => void,
): Promise<GenerationResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: GenerationResult | undefined;

  const consumeBlock = (block: string) => {
    const message = parseBlock(block);
    if (!message) return;
    if (terminal !== undefined) {
      throw new GenerationStreamError("The generation stream had multiple terminal messages.");
    }
    if (message.type === "progress") onProgress(message.event);
    else if (message.type === "result") terminal = message.result;
    else {
      throw new GenerationStreamError(
        message.error.message,
        message.error.code,
        message.error.requestId,
      );
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
