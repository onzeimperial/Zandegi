/**
 * Zod schemas for parsing model JSON output at each pipeline stage. The
 * model's raw text is never trusted directly — every stage's output is
 * parsed and validated here before the orchestrator uses it.
 */

import { z } from "zod";
import {
  DOMAINS,
  GOAL_TYPES,
  EFFORT_BANDS,
  SAFETY_CLASSES,
  VERIFICATION_METHODS,
} from "@zandegi/core";

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
  domains: z.partialRecord(domainEnum, z.number().min(0).max(1)),
  effortBand: effortBandEnum,
  safetyClass: safetyClassEnum,
});
export type ResolveClassification = z.infer<typeof resolveClassificationSchema>;

/**
 * What the API is asked to produce. A partial record does not survive the trip
 * to the wire: it arrives as an object with no properties and the model answers
 * `{}`. So the wire names every domain, and the response is still validated by
 * the stricter schema above.
 */
export const resolveClassificationWireSchema = z.object({
  domains: z.object(
    Object.fromEntries(DOMAINS.map((domain) => [domain, z.number().optional()])) as Record<
      (typeof DOMAINS)[number],
      z.ZodOptional<z.ZodNumber>
    >,
  ),
  effortBand: effortBandEnum,
  safetyClass: safetyClassEnum,
});

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

export const rewriteOutputSchema = z
  .object({
    rewrites: z.array(
      z
        .object({
          issueId: z.string().min(1),
          rewrittenText: z.string().trim().min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type RewriteOutput = z.infer<typeof rewriteOutputSchema>;

// ── Shared parsing ──────────────────────────────────────────

/** Why a model response could not be used. All three can succeed on a second attempt. */
export type ModelOutputFailureKind = "invalid_json" | "schema_mismatch" | "truncated";

export interface ModelOutputIssue {
  /** Where in the output, e.g. `steps.6.verification`. */
  path: string;
  code: string;
  /** What the model sent. Only for a closed-set field, where it is a label rather than prose. */
  received?: string;
}

/**
 * The model answered, but the answer is unusable. A distinct type so the
 * pipeline can retry exactly this and nothing else: a rate limit, a refusal or
 * a bad key does not improve by asking again here.
 */
export class ModelOutputError extends Error {
  constructor(
    readonly stage: string,
    readonly kind: ModelOutputFailureKind,
    message: string,
    readonly issues: readonly ModelOutputIssue[] = [],
  ) {
    super(message);
    this.name = "ModelOutputError";
  }
}

/** One rejected model response, reported whether or not the retry then succeeds. */
export interface ModelOutputRejection {
  stage: string;
  /** Which chapter, for the stage that runs once per chapter. */
  chapterIndex?: number;
  attempt: number;
  willRetry: boolean;
  kind: ModelOutputFailureKind;
  model: string;
  issues: readonly ModelOutputIssue[];
}

const MAX_RECEIVED_LENGTH = 60;
const MAX_REPORTED_ISSUES = 5;

function valueAt(root: unknown, path: readonly PropertyKey[]): unknown {
  let current = root;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function toIssue(raw: unknown, issue: z.core.$ZodIssue): ModelOutputIssue {
  const entry: ModelOutputIssue = { path: issue.path.join("."), code: issue.code };
  if (issue.code !== "invalid_value") return entry;
  const received = JSON.stringify(valueAt(raw, issue.path)) ?? "undefined";
  return { ...entry, received: received.slice(0, MAX_RECEIVED_LENGTH) };
}

/**
 * Parses and validates a stage's raw model text as JSON. Strips a markdown
 * code fence if the model wrapped its output in one despite instructions.
 *
 * Messages deliberately carry no model text: they end up in logs, and step
 * prose can echo what a person wrote about themselves.
 */
export function parseStageJson<T>(stage: string, text: string, schema: z.ZodType<T>): T {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    throw new ModelOutputError(
      stage,
      "invalid_json",
      `[${stage}] model did not return valid JSON (${text.length} characters)`,
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.slice(0, MAX_REPORTED_ISSUES).map((i) => toIssue(raw, i));
    const summary = issues
      .map((i) => `${i.path} ${i.code}${i.received === undefined ? "" : ` received ${i.received}`}`)
      .join("; ");
    throw new ModelOutputError(
      stage,
      "schema_mismatch",
      `[${stage}] model JSON failed schema validation: ${summary}`,
      issues,
    );
  }
  return result.data;
}
