/** Mission generation orchestration with fail-closed validation. */

import { isGenerationBlocked } from "@zandegi/core";
import { interpret } from "./stages/01-interpret";
import { resolve } from "./stages/02-resolve";
import { hydrate } from "./stages/03-hydrate";
import { plan } from "./stages/04-plan";
import { detailChapter } from "./stages/05-detail";
import { validateMissionGrounding } from "./grounding";
import { scoreMission, NEUTRAL_CONTEXT } from "./stages/07-score";
import { safetyPass } from "./stages/08-safety";
import { complete, modelForStage } from "./router";
import { parseStageJson, rewriteOutputSchema } from "./schemas";
import { applyExactRewrites, stepTextFields } from "./rewrite";
import type {
  DraftChapter,
  DraftMission,
  DraftStep,
  GoalInput,
  PipelineResult,
  ProgressCallback,
  RewriteIssue,
  ScoredMission,
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
        ).find(
          (field) => field.field === entry.field && field.itemIndex === entry.itemIndex,
        )!.text,
      })),
    }),
    maxTokens: 1536,
    temperature: 0.3,
    signal,
  });
  const parsed = parseStageJson(stage, response.text, rewriteOutputSchema);
  applyExactRewrites(chapters, issues, parsed.rewrites);
}

export interface GenerateMissionOptions {
  signal?: AbortSignal;
}

export async function generateMission(
  input: GoalInput,
  onEvent?: ProgressCallback,
  options: GenerateMissionOptions = {},
): Promise<PipelineResult> {
  const startedAt = Date.now();
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
      event: null,
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
      event: null,
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
    const initial = validateMissionGrounding(draftMission);
    if (initial.ungroundedClaims.length === 0) return initial;

    await rewriteFlagged("ground", draftChapters, initial.ungroundedClaims, options.signal);
    modelsUsed.ground = modelForStage("ground");
    const revalidated = validateMissionGrounding(draftMission);
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

  const scoredMission: ScoredMission = await runStage("score", async () =>
    scoreMission(draftMission, NEUTRAL_CONTEXT),
  );

  let finalGroundingResult = groundingResult;
  const safetyResult = await runStage("safety", async () => {
    let result = safetyPass(scoredMission, resolved.safetyClass);
    const initialRedactions = result.outcome.redactions;
    if (result.needsRewrite.length > 0) {
      await rewriteFlagged("safety", scoredMission.chapters, result.needsRewrite, options.signal);
      modelsUsed.safety = modelForStage("safety");
      result = safetyPass(scoredMission, resolved.safetyClass);
      if (result.needsRewrite.length > 0) {
        throw new Error("safety rewrite did not resolve every finding");
      }
    }

    const postSafetyGrounding = validateMissionGrounding(scoredMission);
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
  for (const chapter of scoredMission.chapters) {
    emit(onEvent, { stage: "detail", status: "done", chapter });
  }

  return runStage("persist", async () => ({
    event: {
      type: "MissionGenerated" as const,
      occurredAt: new Date().toISOString(),
      payload: {
        goalText: input.rawText,
        pursuitSlug: resolved.slug,
        mission: scoredMission,
        grounding: finalGroundingResult,
        safety: safetyResult.outcome,
        generationMeta: { modelsUsed, totalMs: Date.now() - startedAt },
      },
    },
  }));
}
