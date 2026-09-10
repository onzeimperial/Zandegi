/**
 * @zandegi/ai
 *
 * The mission generation pipeline (SPEC §2.2, nine stages). The model writes
 * content; it never assigns a number that affects progression (CLAUDE.md
 * §2.5). All model access goes through ./router.
 *
 * Status: stages 6 (ground), 7 (score), 8 (safety) are complete and tested.
 * Stages 1–5, 9 and the orchestrator are scaffolded; they need
 * ANTHROPIC_API_KEY to run. The spike harness lives in ./harness.
 */

export * from "./types";
export * from "./router";
export * from "./grounding";
export { scoreMission, NEUTRAL_CONTEXT, type ScoreContext } from "./stages/07-score";
export { safetyPass, type SafetyPassResult } from "./stages/08-safety";
