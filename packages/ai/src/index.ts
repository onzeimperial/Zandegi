/**
 * @zandegi/ai
 *
 * The mission generation content pipeline (SPEC §2.2). The model writes
 * content; it never assigns a number that affects progression (CLAUDE.md
 * §2.5). All model access goes through ./router.
 *
 * Scope, narrowed in story 1.3: this package returns a **validated draft**
 * and nothing else. It owns the seven content stages (interpret, resolve,
 * hydrate, plan, detail, ground, safety) and creates no clock, identifier,
 * identity, transaction, persistence or ledger fact. The former `score` stage
 * is gone — XP exists only once a completion event is accepted (law 3) — and
 * the former `persist` stage is gone, because it fabricated a
 * `MissionGenerated` event and wrote nothing. `@zandegi/api` orchestrates the
 * draft behind injected ports.
 *
 * Two real limitations, both documented at their source and tracked for later
 * stories rather than silently papered over:
 *   - Stage 2 (resolve) always uses the generic scaffold — no Pursuit
 *     catalog exists yet (stories 1.5–1.14).
 *   - Stage 3 (hydrate) is a no-op — no knowledge layer exists yet
 *     (story 1.17); the API's knowledge port is the seam for it.
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
export { safetyPass, type SafetyPassResult } from "./stages/08-safety";
export { generateMissionDraft, type GenerateMissionDraftOptions } from "./pipeline";
export { localDate } from "./person-context";
