export function generationRequestInit(rawText: string, signal: AbortSignal): RequestInit {
  return { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({rawText}), signal };
}
