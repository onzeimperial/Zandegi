/**
 * @zandegi/ai
 *
 * The mission generation pipeline (SPEC §2.2, nine stages). The model writes
 * content; it never assigns a number that affects progression (CLAUDE.md
 * §2.5). All model access goes through ./router.
 *
 * Status: all nine stages and the orchestrator (`generateMission` in
 * ./pipeline) exist and are tested against a mocked model client. Two real
 * limitations, both documented at their source and tracked for later
 * sessions rather than silently papered over:
 *   - Stage 2 (resolve) always uses the generic scaffold — no Pursuit
 *     catalog exists yet (BUILD-PROMPTS session 2).
 *   - Stage 3 (hydrate) is a no-op — no knowledge layer exists yet
 *     (session 2 for real knowledgeSlots, session 3 for KnowledgeEntity).
 *   - Stage 9 (persist) constructs the MissionGenerated event but writes
 *     nothing — no database exists yet (session 3).
 * Requires a real ANTHROPIC_API_KEY in .env to actually call the model.
 */

export * from "./types";
export * from "./router";
export * from "./grounding";
export * from "./schemas";
export { interpret } from "./stages/01-interpret";
export { resolve } from "./stages/02-resolve";
export { hydrate } from "./stages/03-hydrate";
export { plan } from "./stages/04-plan";
export { detailChapter, type DetailChapterInput } from "./stages/05-detail";
export { scoreMission, NEUTRAL_CONTEXT, type ScoreContext } from "./stages/07-score";
export { safetyPass, type SafetyPassResult } from "./stages/08-safety";
export { generateMission } from "./pipeline";
