import type {
  GenerateMissionRequest,
  GenerationProgress,
  GenerationResult,
} from "@zandegi/api/client";
import { consumeGenerationStream, GenerationStreamError } from "./sse";
import { generationRequestInit } from "./request";

export type GenerationFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export async function runGeneration(
  request: GenerateMissionRequest,
  signal: AbortSignal,
  onProgress: (event: GenerationProgress) => void,
  fetcher: GenerationFetch = fetch,
): Promise<GenerationResult> {
  const response = await fetcher("/api/generate", generationRequestInit(request, signal));
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string; requestId?: string };
    };
    // The code travels with the message: the screen answers a daily limit or a
    // lapsed session differently from a failed build.
    throw new GenerationStreamError(
      body.error?.message ?? `Request failed (${response.status})`,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.requestId,
    );
  }
  return consumeGenerationStream(response.body, onProgress);
}
