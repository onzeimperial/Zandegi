import {
  GENERATION_STAGES,
  type GenerationProgress,
  type GenerationResult,
  type GenerationStage,
  type MissionChapter,
} from "@zandegi/api/client";

export type GeneratorStatus = "idle" | "generating" | "done" | "refusal" | "error";
export interface GeneratorState {
  status: GeneratorStatus;
  activeStage: GenerationStage | null;
  detail: string | null;
  chapters: MissionChapter[];
  result: GenerationResult | null;
  error: string | null;
  /** The server's request id, so a person can quote the failure they saw. */
  errorReference: string | null;
  /** The stable code, when the server sent one. */
  errorCode: string | null;
}
export const initialGeneratorState: GeneratorState = {
  status: "idle",
  activeStage: null,
  detail: null,
  chapters: [],
  result: null,
  error: null,
  errorReference: null,
  errorCode: null,
};
export function canSubmitGeneration(rawText: string, status: GeneratorStatus) {
  return rawText.trim().length > 0 && status !== "generating";
}
export function visibleStageState(
  stage: GenerationStage,
  activeStage: GenerationStage | null,
): "active" | "done" | "pending" {
  if (activeStage === stage || (stage === "resolve" && activeStage === "hydrate")) return "active";
  // Stage order comes from the contract, so the screen cannot drift from the
  // stages the server actually runs.
  return activeStage !== null &&
    GENERATION_STAGES.indexOf(activeStage) > GENERATION_STAGES.indexOf(stage)
    ? "done"
    : "pending";
}
export type GeneratorAction =
  | { type: "start" }
  | { type: "progress"; event: GenerationProgress }
  | { type: "result"; result: GenerationResult }
  | { type: "error"; message: string; reference?: string; code?: string }
  | { type: "reset" };

export function generatorReducer(state: GeneratorState, action: GeneratorAction): GeneratorState {
  if (action.type === "reset") return initialGeneratorState;
  if (action.type === "start") return { ...initialGeneratorState, status: "generating" };
  if (action.type === "error")
    return {
      ...state,
      status: "error",
      error: action.message,
      errorReference: action.reference ?? null,
      errorCode: action.code ?? null,
    };
  if (action.type === "result")
    return {
      ...state,
      status: action.result.outcome === "refusal" ? "refusal" : "done",
      result: action.result,
    };
  return {
    ...state,
    activeStage: action.event.stage,
    detail: action.event.detail ?? null,
    chapters: action.event.chapter ? [...state.chapters, action.event.chapter] : state.chapters,
  };
}
