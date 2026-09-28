import type { PipelineResult, ScoredChapter, StageEvent } from "@zandegi/ai";

export type GeneratorStatus = "idle" | "generating" | "done" | "refusal" | "error";
export interface GeneratorState { status: GeneratorStatus; activeStage: StageEvent["stage"] | null; detail: string | null; chapters: ScoredChapter[]; result: PipelineResult | null; error: string | null; }
export const initialGeneratorState: GeneratorState = { status:"idle", activeStage:null, detail:null, chapters:[], result:null, error:null };
export function canSubmitGeneration(rawText:string,status:GeneratorStatus){return rawText.trim().length>0&&status!=="generating";}
const STAGE_ORDER:StageEvent["stage"][]=["interpret","resolve","hydrate","plan","detail","ground","score","safety","persist"];
export function visibleStageState(stage:StageEvent["stage"],activeStage:StageEvent["stage"]|null):"active"|"done"|"pending"{
  if(activeStage===stage||(stage==="resolve"&&activeStage==="hydrate"))return"active";
  return activeStage!==null&&STAGE_ORDER.indexOf(activeStage)>STAGE_ORDER.indexOf(stage)?"done":"pending";
}
export type GeneratorAction = { type:"start" } | { type:"progress"; event:StageEvent } | { type:"result"; result:PipelineResult } | { type:"error"; message:string } | { type:"reset" };

export function generatorReducer(state: GeneratorState, action: GeneratorAction): GeneratorState {
  if (action.type === "reset") return initialGeneratorState;
  if (action.type === "start") return { ...initialGeneratorState, status:"generating" };
  if (action.type === "error") return { ...state, status:"error", error:action.message };
  if (action.type === "result") return { ...state, status:action.result.refusal ? "refusal" : "done", result:action.result };
  return { ...state, activeStage:action.event.stage, detail:action.event.detail ?? null, chapters:action.event.chapter ? [...state.chapters, action.event.chapter] : state.chapters };
}
