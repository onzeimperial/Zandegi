/** Mission generation orchestration with fail-closed validation. */

import { isGenerationBlocked } from "@zandegi/core";
import { interpret } from "./stages/01-interpret";
import { resolve } from "./stages/02-resolve";
import { hydrate } from "./stages/03-hydrate";
import { plan } from "./stages/04-plan";
import { detailChapter } from "./stages/05-detail";
import { validateMissionGrounding } from "./grounding";
import { safetyPass } from "./stages/08-safety";
import { complete, modelForStage } from "./router";
import { parseStageJson, rewriteOutputSchema } from "./schemas";
import { applyExactRewrites, stepTextFields } from "./rewrite";
import type {
  DraftChapter,
  DraftMission,
  DraftStep,
  GoalInput,
  MissionDraftOutcome,
  ProgressCallback,
  RewriteIssue,
  StageEvent,
  StageName,
} from "./types";

function emit(onEvent: ProgressCallback | undefined, event: StageEvent): void {
  onEvent?.(event);
}

async function rewriteFlagged(
  stage: Extract<StageName, "ground" | "safety">,
  chapters: DraftChapter[],
  issues: RewriteIssue[],
  signal?: AbortSignal,
): Promise<void> {
  const system =
    stage === "ground"
      ? `Rewrite each supplied text field so its unsourced factual claim becomes honest, non-factual
advice with the same helpful intent. Do not retain specific unsourced numbers, dates, prices, or rules.
Output ONLY JSON: { "rewrites": [{ "issueId": string, "rewrittenText": string }] }.
Return every supplied issueId exactly once and no other IDs.`
      : `Rewrite each supplied text field so it is safe and appropriately framed. For health,
financial, or legal topics, direct the user to a suitable professional; never prescribe, diagnose,
or give personal financial or legal directives. Output ONLY JSON: { "rewrites": [{ "issueId":
string, "rewrittenText": string }] }. Return every supplied issueId exactly once and no other IDs.`;

  const response = await complete({
    stage,
    system,
    user: JSON.stringify({
      issues: issues.map((entry) => ({
        issueId: entry.issueId,
        issue: entry.issue,
        currentText: stepTextFields(
          entry.chapterIndex,
          entry.stepIndex,
          chapters[entry.chapterIndex]!.steps[entry.stepIndex]!,
        ).find((field) => field.field === entry.field && field.itemIndex === entry.itemIndex)!.text,
      })),
    }),
    maxTokens: 1536,
    temperature: 0.3,
    signal,
  });
  const parsed = parseStageJson(stage, response.text, rewriteOutputSchema);
  applyExactRewrites(chapters, issues, parsed.rewrites);
}

export interface GenerateMissionDraftOptions {
  /**
   * The one request-scoped evaluation instant, supplied by the API clock port.
   * It is required so this package can never fall back to an ambient clock:
   * every freshness decision in a run is judged against the same moment.
   */
  asOf: Date;
  signal?: AbortSignal;
}

/**
 * Produce validated draft content for a goal. This package owns the seven
 * content stages and nothing else: no clock, no identifiers, no persistence,
 * no event, and no number that affects progression. `@zandegi/api` orchestrates
 * the result into the client-facing contract.
 */
export async function generateMissionDraft(
  input: GoalInput,
  // Explicitly nullable rather than optional: `options` carries the required
  // evaluation instant, and a required parameter cannot follow an optional one.
  onEvent: ProgressCallback | undefined,
  options: GenerateMissionDraftOptions,
): Promise<MissionDraftOutcome> {
  const modelsUsed: Partial<Record<StageName, string>> = {};

  async function runStage<T>(stage: StageName, fn: () => Promise<T>): Promise<T> {
    options.signal?.throwIfAborted();
    emit(onEvent, { stage, status: "start" });
    try {
      const result = await fn();
      options.signal?.throwIfAborted();
      emit(onEvent, { stage, status: "done" });
      return result;
    } catch (error) {
      emit(onEvent, { stage, status: "error" });
      throw error;
    }
  }

  const interpretation = await runStage("interpret", () => interpret(input, options.signal));
  modelsUsed.interpret = modelForStage("interpret");

  if (interpretation.notes.isImpossibleScope) {
    return {
      draft: null,
      refusal: {
        reason: "The goal as stated isn't achievable in the implied timeframe.",
        route: "clarify",
      },
    };
  }

  const resolved = await runStage("resolve", () => resolve(interpretation, options.signal));
  modelsUsed.resolve = modelForStage("resolve");

  if (isGenerationBlocked(resolved.safetyClass)) {
    return {
      draft: null,
      refusal: { reason: "This needs a person, not a mission.", route: "support" },
    };
  }

  await runStage("hydrate", () => hydrate(resolved));
  const planResult = await runStage("plan", () => plan(interpretation, resolved, options.signal));
  modelsUsed.plan = modelForStage("plan");

  const draftChapters: DraftChapter[] = [];
  for (let chapterIndex = 0; chapterIndex < planResult.chapters.length; chapterIndex++) {
    options.signal?.throwIfAborted();
    const skeleton = planResult.chapters[chapterIndex]!;
    emit(onEvent, { stage: "detail", status: "start" });

    let detailOutput;
    try {
      detailOutput = await detailChapter(
        {
          chapterTitle: skeleton.title,
          exitCondition: skeleton.exitCondition,
          interpretation,
          resolved,
        },
        options.signal,
      );
      options.signal?.throwIfAborted();
      modelsUsed.detail = modelForStage("detail");
    } catch (error) {
      emit(onEvent, { stage: "detail", status: "error" });
      throw error;
    }

    const steps: DraftStep[] = detailOutput.steps.map((step, stepIndex) => ({
      index: stepIndex,
      title: step.title,
      estimatedMinutes: step.estimatedMinutes,
      verification: step.verification,
      guide: step.guide,
      sources: step.sources ?? [],
      toolKinds: step.toolKinds ?? [],
    }));
    draftChapters.push({
      index: chapterIndex,
      title: skeleton.title,
      exitCondition: skeleton.exitCondition,
      steps,
    });
    emit(onEvent, { stage: "detail", status: "done" });
  }

  const draftMission: DraftMission = {
    title: planResult.missionTitle,
    goalType: interpretation.goalType,
    primaryDomain: planResult.primaryDomain,
    chapters: draftChapters,
  };

  const groundingResult = await runStage("ground", async () => {
    const initial = validateMissionGrounding(draftMission, options.asOf);
    if (initial.ungroundedClaims.length === 0) return initial;

    await rewriteFlagged("ground", draftChapters, initial.ungroundedClaims, options.signal);
    modelsUsed.ground = modelForStage("ground");
    const revalidated = validateMissionGrounding(draftMission, options.asOf);
    if (revalidated.ungroundedClaims.length > 0) {
      throw new Error("grounding rewrite did not resolve every finding");
    }
    return {
      ...revalidated,
      claimsChecked: initial.claimsChecked,
      rewritten: initial.ungroundedClaims.length,
      dropped: 0,
    };
  });

  let finalGroundingResult = groundingResult;
  const safetyResult = await runStage("safety", async () => {
    let result = safetyPass(draftMission, resolved.safetyClass);
    const initialRedactions = result.outcome.redactions;
    if (result.needsRewrite.length > 0) {
      await rewriteFlagged("safety", draftChapters, result.needsRewrite, options.signal);
      modelsUsed.safety = modelForStage("safety");
      result = safetyPass(draftMission, resolved.safetyClass);
      if (result.needsRewrite.length > 0) {
        throw new Error("safety rewrite did not resolve every finding");
      }
    }

    const postSafetyGrounding = validateMissionGrounding(draftMission, options.asOf);
    if (postSafetyGrounding.ungroundedClaims.length > 0) {
      throw new Error("safety rewrite introduced an ungrounded finding");
    }
    finalGroundingResult = {
      ...postSafetyGrounding,
      rewritten: groundingResult.rewritten,
      dropped: groundingResult.dropped,
    };
    return {
      ...result,
      outcome: { ...result.outcome, redactions: initialRedactions },
    };
  });

  // Chapters are released only after both content validators succeed.
  for (const chapter of draftMission.chapters) {
    emit(onEvent, { stage: "detail", status: "done", chapter });
  }

  return {
    draft: {
      goalText: input.rawText,
      pursuitSlug: resolved.slug,
      mission: draftMission,
      grounding: finalGroundingResult,
      safety: safetyResult.outcome,
      modelsUsed,
    },
  };
}
