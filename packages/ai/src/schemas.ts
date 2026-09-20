/**
 * Zod schemas for parsing model JSON output at each pipeline stage. The
 * model's raw text is never trusted directly — every stage's output is
 * parsed and validated here before the orchestrator uses it.
 */

import { z } from "zod";
import { DOMAINS, GOAL_TYPES, EFFORT_BANDS, SAFETY_CLASSES, VERIFICATION_METHODS } from "@zandegi/core";

export const domainEnum = z.enum(DOMAINS);
export const goalTypeEnum = z.enum(GOAL_TYPES);
export const effortBandEnum = z.enum(EFFORT_BANDS);
export const safetyClassEnum = z.enum(SAFETY_CLASSES);
export const verificationEnum = z.enum(VERIFICATION_METHODS);

// ── Stage 1: Interpret ─────────────────────────────────────

export const interpretationOutputSchema = z.object({
  intent: z.string().min(1),
  goalType: goalTypeEnum,
  constraints: z.object({
    deadline: z.string().optional(),
    currentLevel: z.string().optional(),
    resources: z.array(z.string()).optional(),
  }),
  timeBudgetMinutesPerWeek: z.number().positive(),
  location: z.string().optional(),
  notes: z.object({
    isVague: z.boolean().optional(),
    isImpossibleScope: z.boolean().optional(),
    dependsOnVolatileFacts: z.boolean().optional(),
  }),
});
export type InterpretationOutput = z.infer<typeof interpretationOutputSchema>;

// ── Stage 2: Resolve ───────────────────────────────────────

export const resolveClassificationSchema = z.object({
  domains: z.record(domainEnum, z.number().min(0).max(1)),
  effortBand: effortBandEnum,
  safetyClass: safetyClassEnum,
});
export type ResolveClassification = z.infer<typeof resolveClassificationSchema>;

// ── Stage 4: Plan ──────────────────────────────────────────

export const planOutputSchema = z.object({
  missionTitle: z.string().min(1),
  primaryDomain: domainEnum,
  chapters: z
    .array(
      z.object({
        title: z.string().min(1),
        exitCondition: z.string().min(1),
      }),
    )
    .min(3)
    .max(7),
});
export type PlanOutput = z.infer<typeof planOutputSchema>;

// ── Stage 5: Detail ────────────────────────────────────────

export const sourceOutputSchema = z.object({
  title: z.string().min(1),
  url: z.string().optional(),
  date: z.string().min(1),
});

export const stepGuideOutputSchema = z.object({
  approach: z.string().min(1),
  materials: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  whatGoodLooksLike: z.string().min(1),
});

export const draftStepOutputSchema = z.object({
  title: z.string().min(1),
  estimatedMinutes: z.number().positive(),
  verification: verificationEnum,
  guide: stepGuideOutputSchema,
  sources: z.array(sourceOutputSchema).default([]),
  toolKinds: z.array(z.string()).default([]),
});

export const detailChapterOutputSchema = z.object({
  steps: z.array(draftStepOutputSchema).min(2).max(9),
});
export type DetailChapterOutput = z.infer<typeof detailChapterOutputSchema>;

// ── Grounding / safety rewrite passes ──────────────────────

export const rewriteOutputSchema = z.object({
  rewrites: z.array(
    z.object({
      chapterIndex: z.number().int(),
      stepIndex: z.number().int(),
      rewrittenApproach: z.string().min(1),
    }),
  ),
});
export type RewriteOutput = z.infer<typeof rewriteOutputSchema>;

// ── Shared parsing ──────────────────────────────────────────

/**
 * Parses and validates a stage's raw model text as JSON. Strips a markdown
 * code fence if the model wrapped its output in one despite instructions.
 */
export function parseStageJson<T>(stage: string, text: string, schema: z.ZodType<T>): T {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch (err) {
    throw new Error(`[${stage}] model did not return valid JSON: ${(err as Error).message}\n---\n${text}`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`[${stage}] model JSON failed schema validation: ${result.error.message}`);
  }
  return result.data;
}
