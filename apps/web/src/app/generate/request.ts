import type { GenerateMissionRequest } from "@zandegi/api/client";

export function generationRequestInit(
  request: GenerateMissionRequest,
  signal: AbortSignal,
): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  };
}
