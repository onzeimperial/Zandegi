import type { PipelineResult,StageEvent } from "@zandegi/ai";
import { consumeGenerationStream } from "./sse";
import { generationRequestInit } from "./request";

export type GenerationFetch=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export async function runGeneration(rawText:string,signal:AbortSignal,onProgress:(event:StageEvent)=>void,fetcher:GenerationFetch=fetch):Promise<PipelineResult>{
  const response=await fetcher("/api/generate",generationRequestInit(rawText,signal));
  if(!response.ok||!response.body){const body=await response.json().catch(()=>({})) as {error?:{message?:string}};throw new Error(body.error?.message??`Request failed (${response.status})`);}
  return consumeGenerationStream(response.body,onProgress);
}
