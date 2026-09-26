import { describe, expect, it, vi } from "vitest";
import { consumeGenerationStream } from "./sse";

function stream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("consumeGenerationStream", () => {
  it("parses messages split across arbitrary chunks and returns the result", async () => {
    const progress = vi.fn();
    const result = await consumeGenerationStream(
      stream(
        'data: {"type":"progress","event":{"stage":"plan",',
        '"status":"done"}}\r',
        '\n\r',
        '\ndata: {"type":"result","result":{"event":null,',
        '"refusal":{"reason":"narrow it","route":"clarify"}},"requestId":"r1"}\n\n',
      ),
      progress,
    );
    expect(progress).toHaveBeenCalledWith({ stage: "plan", status: "done" });
    expect(result.refusal?.route).toBe("clarify");
  });

  it("throws the stable terminal error", async () => {
    await expect(
      consumeGenerationStream(
        stream(
          'data: {"type":"error","error":{"code":"GENERATION_FAILED","message":"Mission generation failed. Try again.","requestId":"r2"}}\n\n',
        ),
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      requestId: "r2",
    });
  });

  it("rejects premature EOF instead of reporting success", async () => {
    await expect(
      consumeGenerationStream(
        stream('data: {"type":"progress","event":{"stage":"plan","status":"done"}}\n\n'),
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "PREMATURE_EOF" });
  });

  it("rejects malformed and duplicate terminal messages", async () => {
    await expect(consumeGenerationStream(stream("data: not-json\n\n"), vi.fn())).rejects.toThrow(
      "stream was invalid",
    );
    const result =
      'data: {"type":"result","result":{"event":null,"refusal":{"reason":"narrow","route":"clarify"}},"requestId":"r"}\n\n';
    await expect(consumeGenerationStream(stream(result, result), vi.fn())).rejects.toThrow(
      "multiple terminal",
    );
  });

  it.each([
    '{}',
    '{"type":"progress","event":{"stage":"unknown","status":"done"}}',
    '{"type":"result","result":{"event":null}}',
    '{"type":"result","result":{"event":"wrong"},"requestId":"r"}',
    '{"type":"result","result":{"event":{}},"requestId":"r"}',
    '{"type":"error","error":{"code":"FAILED"}}',
  ])("turns malformed payload shape %s into a stable stream error", async (payload) => {
    await expect(
      consumeGenerationStream(stream(`data: ${payload}\n\n`), vi.fn()),
    ).rejects.toMatchObject({
      name: "GenerationStreamError",
      code: "INVALID_STREAM",
      message: "The generation stream was invalid.",
    });
  });

  it("cancels and releases the reader when parsing fails", async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const malformed = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: not-json\n\n"));
      },
      cancel,
    });
    await expect(consumeGenerationStream(malformed, vi.fn())).rejects.toThrow("stream was invalid");
    expect(cancel).toHaveBeenCalledOnce();
    expect(malformed.locked).toBe(false);
  });
});
