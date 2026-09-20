/**
 * The generation pipeline orchestrator (SPEC §2.2). Chains all 9 stages,
 * short-circuits for safety before any chapter/step is drafted, streams each
 * chapter to `onEvent` as it's detailed and scored, and runs the
 * grounding/safety rewrite-then-revalidate passes before returning the
 * final `MissionGenerated` event.
 *
 * Stage 9 (persist) does not write anywhere — no database exists yet
 * (BUILD-PROMPTS session 3). It only constructs and returns the event; a
 * caller with a database wires the actual write.
 */

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
import type {
  GoalInput,
  DraftChapter,
  DraftStep,
  DraftMission,
  ScoredMission,
  ProgressCallback,
  PipelineResult,
  StageEvent,
  StageName,
} from "./types";

function emit(onEvent: ProgressCallback | undefined, event: StageEvent): void {
  onEvent?.(event);
}

/** Applies model-authored rewrites of `guide.approach` to the steps they target. */
function applyApproachRewrites(
  chapters: DraftChapter[],
  rewrites: { chapterIndex: number; stepIndex: number; rewrittenApproach: string }[],
): void {
  for (const r of rewrites) {
    const step = chapters[r.chapterIndex]?.steps[r.stepIndex];
    if (step) step.guide.approach = r.rewrittenApproach;
  }
}

/**
 * One model call that rewrites every flagged step's `guide.approach` at
 * once. Used by both stage 6 (ungrounded claims) and stage 8 (safety
 * violations) — same shape, different framing instructions.
 */
async function rewriteFlagged(
  stage: Extract<StageName, "ground" | "safety">,
  chapters: DraftChapter[],
  issues: { chapterIndex: number; stepIndex: number; issue: string }[],
): Promise<void> {
  const system =
    stage === "ground"
      ? `You rewrite mission step guidance that made an unsourced factual claim into honest,
non-factual advice — same helpful intent, no specific unsourced numbers, dates, prices, or rules.
Output ONLY JSON: { "rewrites": [{ "chapterIndex": number, "stepIndex": number,
"rewrittenApproach": string }] } — one entry per issue given, in the same order.`
      : `You rewrite mission step guidance that crossed a safety line (a diagnosis, a specific
dose, a personal financial/legal directive, or an unsafe target) into safe, appropriately framed
guidance — for health/financial/legal topics, frame as "bring this to a professional", never
prescribe or diagnose. Output ONLY JSON: { "rewrites": [{ "chapterIndex": number, "stepIndex":
number, "rewrittenApproach": string }] } — one entry per issue given, in the same order.`;

  const res = await complete({
    stage,
    system,
    user: JSON.stringify({
      issues: issues.map((i) => ({
        chapterIndex: i.chapterIndex,
        stepIndex: i.stepIndex,
        issue: i.issue,
        currentApproach: chapters[i.chapterIndex]?.steps[i.stepIndex]?.guide.approach,
      })),
    }),
    maxTokens: 1536,
    temperature: 0.3,
  });
  const parsed = parseStageJson(stage, res.text, rewriteOutputSchema);
  applyApproachRewrites(chapters, parsed.rewrites);
}

export async function generateMission(
  input: GoalInput,
  onEvent?: ProgressCallback,
): Promise<PipelineResult> {
  const startedAt = Date.now();
  const modelsUsed: Partial<Record<StageName, string>> = {};

  // Stages that never call the model (hydrate is a no-op today, score is
  // deterministic, persist only constructs an object) never appear here —
  // `modelsUsed` should only ever name a stage that actually made a call.
  async function runStage<T>(stage: StageName, fn: () => Promise<T>): Promise<T> {
    emit(onEvent, { stage, status: "start" });
    try {
      const result = await fn();
      emit(onEvent, { stage, status: "done" });
      return result;
    } catch (err) {
      emit(onEvent, { stage, status: "error", detail: (err as Error).message });
      throw err;
    }
  }

  // Stage 1 — Interpret
  const interpretation = await runStage("interpret", () => interpret(input));
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

  // Stage 2 — Resolve (always the generic scaffold — no Pursuit catalog yet)
  const resolved = await runStage("resolve", () => resolve(interpretation));
  modelsUsed.resolve = modelForStage("resolve");

  // Safety gate — SELF_HARM_ADJACENT is never generated (SPEC Part X).
  if (isGenerationBlocked(resolved.safetyClass)) {
    return {
      event: null,
      refusal: { reason: "This needs a person, not a mission.", route: "support" },
    };
  }

  // Stage 3 — Hydrate (no-op today, see stages/03-hydrate.ts)
  await runStage("hydrate", () => hydrate(resolved));

  // Stage 4 — Plan
  const planResult = await runStage("plan", () => plan(interpretation, resolved));
  modelsUsed.plan = modelForStage("plan");

  // Stage 5 — Detail, per chapter, streaming each as it's scored.
  const draftChapters: DraftChapter[] = [];
  for (let i = 0; i < planResult.chapters.length; i++) {
    const skeleton = planResult.chapters[i]!;
    emit(onEvent, { stage: "detail", status: "start" });

    let detailOutput;
    try {
      detailOutput = await detailChapter({
        chapterTitle: skeleton.title,
        exitCondition: skeleton.exitCondition,
        interpretation,
        resolved,
      });
      modelsUsed.detail = modelForStage("detail");
    } catch (err) {
      emit(onEvent, { stage: "detail", status: "error", detail: (err as Error).message });
      throw err;
    }

    const steps: DraftStep[] = detailOutput.steps.map((s, stepIndex) => ({
      index: stepIndex,
      title: s.title,
      estimatedMinutes: s.estimatedMinutes,
      verification: s.verification,
      guide: s.guide,
      sources: s.sources ?? [],
      toolKinds: s.toolKinds ?? [],
    }));
    const chapter: DraftChapter = {
      index: i,
      title: skeleton.title,
      exitCondition: skeleton.exitCondition,
      steps,
    };
    draftChapters.push(chapter);

    // Progressive reveal: score this chapter alone (chapter XP only depends
    // on its own steps) and emit it immediately.
    const previewMission: DraftMission = {
      title: planResult.missionTitle,
      goalType: interpretation.goalType,
      primaryDomain: planResult.primaryDomain,
      chapters: [chapter],
    };
    const previewScored = scoreMission(previewMission, NEUTRAL_CONTEXT);
    emit(onEvent, { stage: "detail", status: "done", chapter: previewScored.chapters[0] });
  }

  const draftMission: DraftMission = {
    title: planResult.missionTitle,
    goalType: interpretation.goalType,
    primaryDomain: planResult.primaryDomain,
    chapters: draftChapters,
  };

  // Stage 6 — Ground: every hard factual claim needs a dated source, or gets
  // rewritten as advice (grounding.ts detects; the rewrite is a model call).
  const groundingResult = await runStage("ground", async () => {
    const report = validateMissionGrounding(draftMission);
    if (report.ungroundedClaims.length === 0) return report;

    await rewriteFlagged(
      "ground",
      draftChapters,
      report.ungroundedClaims.map((c) => ({
        chapterIndex: c.chapterIndex,
        stepIndex: c.stepIndex,
        issue: c.claim,
      })),
    );
    modelsUsed.ground = modelForStage("ground");
    const revalidated = validateMissionGrounding(draftMission);
    const rewritten = report.ungroundedClaims.length - revalidated.ungroundedClaims.length;

    // Anything still ungrounded after one honest rewrite attempt is dropped
    // outright — CLAUDE.md §2.6 does not allow shipping an unsourced hard
    // claim under any circumstance.
    let dropped = 0;
    for (const claim of revalidated.ungroundedClaims) {
      const step = draftChapters[claim.chapterIndex]?.steps[claim.stepIndex];
      if (step) step.guide.approach = step.guide.approach.replace(claim.claim, "").trim();
      dropped++;
    }
    return { ...revalidated, ungroundedClaims: [], rewritten, dropped };
  });

  // Stage 7 — Score. Deterministic, no model call (CLAUDE.md §2.5).
  const scoredMission: ScoredMission = await runStage("score", async () =>
    scoreMission(draftMission, NEUTRAL_CONTEXT),
  );

  // Stage 8 — Safety pass. Routes/rewrites by safetyClass (Part X).
  // scoreMission shallow-spreads each step, so scoredMission's steps share
  // the same `guide` object reference as draftChapters' — rewriting
  // draftChapters here is already reflected in scoredMission.
  const safetyResult = await runStage("safety", async () => {
    let result = safetyPass(scoredMission, resolved.safetyClass);
    if (result.needsRewrite.length === 0) return result;

    await rewriteFlagged(
      "safety",
      draftChapters,
      result.needsRewrite.map((r) => ({
        chapterIndex: r.chapterIndex,
        stepIndex: r.stepIndex,
        issue: `Contains disallowed pattern: ${r.pattern}`,
      })),
    );
    modelsUsed.safety = modelForStage("safety");
    result = safetyPass(scoredMission, resolved.safetyClass);
    return result;
  });

  // Stage 9 — Persist + emit. No database exists yet (session 3); this
  // constructs the event only. A caller with a database writes it.
  return runStage("persist", async () => ({
    event: {
      type: "MissionGenerated" as const,
      occurredAt: new Date().toISOString(),
      payload: {
        goalText: input.rawText,
        pursuitSlug: resolved.slug,
        mission: scoredMission,
        grounding: groundingResult,
        safety: safetyResult.outcome,
        generationMeta: { modelsUsed, totalMs: Date.now() - startedAt },
      },
    },
  }));
}
