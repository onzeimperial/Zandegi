/**
 * Model routing. **The only place the Anthropic SDK is constructed or
 * called** (CLAUDE.md §3) — no route, component, or other package touches it
 * directly.
 *
 * Each pipeline stage names its model here rather than hard-coding one, so
 * cost/quality tuning (session 10's cost model) happens in one file.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ModelOutputError } from "./schemas";
import type { StageName } from "./types";

export const MODELS = {
  /** Fast, cheap — classification and short structured extraction. */
  fast: "claude-haiku-4-5-20251001",
  /** The workhorse — planning and step detail. */
  standard: "claude-sonnet-5",
  /** Reserved for deep-research missions (Prime tier, SPEC §5.1). */
  deep: "claude-opus-5",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * Whether a tier's model accepts sampling parameters.
 *
 * Sonnet 5 and the Opus 5 family reject `temperature`, `top_p` and `top_k`
 * outright — the API answers `400 invalid_request_error: \`temperature\` is
 * deprecated for this model`. Haiku 4.5 still accepts them. Depth on the newer
 * models is steered with effort, not sampling.
 *
 * This lives here because the router owns model choice: a stage that moves to
 * another tier must not be able to reintroduce the 400.
 */
const ACCEPTS_SAMPLING: Record<ModelTier, boolean> = {
  fast: true,
  standard: false,
  deep: false,
};

/**
 * Effort per tier.
 *
 * Sonnet 5 runs adaptive thinking whenever `thinking` is omitted, and thinking
 * tokens count against `max_tokens`. Measured on a real generation: the plan
 * stage took 10.2s and one chapter of detail took 32s, then had its JSON cut
 * off mid-string because reasoning had consumed the budget. These stages turn
 * a structured brief into structured JSON under a 25s deadline; they do not
 * repay deep deliberation. `low` keeps thinking on (disabling it outright has
 * its own failure modes) but makes it brief.
 *
 * Haiku 4.5 rejects `effort`, so the fast tier sends none.
 */
const TIER_EFFORT: Record<ModelTier, "low" | "medium" | "high" | undefined> = {
  fast: undefined,
  standard: "low",
  deep: undefined,
};

/** Which tier each model-using stage runs on. Stages 7–9 are not here — they never call the model. */
const STAGE_TIER: Partial<Record<StageName, ModelTier>> = {
  interpret: "fast",
  resolve: "fast",
  hydrate: "fast",
  plan: "standard",
  detail: "standard",
  ground: "fast",
  safety: "fast",
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. The generation pipeline cannot run without it. " +
        "Add it to .env at the repo root.",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export interface CompleteOptions {
  stage: StageName;
  system: string;
  user: string;
  /** Force a tier, overriding STAGE_TIER (used by the harness judge). */
  tier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /**
   * Constrain the response to this schema at generation time (structured
   * outputs), so the JSON is well formed and closed-set fields hold an allowed
   * value. Asking for "ONLY a JSON object" as free text failed on real output:
   * one unescaped quote inside a step's guide discarded a whole seven-chapter
   * mission and every call already paid for.
   *
   * This does not make the output valid. The API cannot enforce string lengths,
   * number ranges or most array bounds, so the caller still validates with Zod
   * and the pipeline retries a rejected response.
   */
  schema?: z.ZodType;
}

type JsonSchemaNode = Record<string, unknown>;

function isNode(value: unknown): value is JsonSchemaNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Copy `enum` and `const` from the full schema back onto the one being sent. */
function restoreClosedSets(source: JsonSchemaNode, target: JsonSchemaNode): void {
  let restored = false;
  for (const key of ["enum", "const"]) {
    if (key in source && !(key in target)) {
      target[key] = source[key];
      restored = true;
    }
  }
  if (restored) {
    // The SDK left these constraints in the description as text.
    if (source.description === undefined) delete target.description;
    else target.description = source.description;
  }

  for (const key of ["$defs", "properties"]) {
    const from = source[key];
    const to = target[key];
    if (!isNode(from) || !isNode(to)) continue;
    for (const [name, child] of Object.entries(from)) {
      const counterpart = to[name];
      if (isNode(child) && isNode(counterpart)) restoreClosedSets(child, counterpart);
    }
  }
  if (isNode(source.items) && isNode(target.items)) restoreClosedSets(source.items, target.items);

  // The SDK rewrites `oneOf` to `anyOf`.
  const variants = source.anyOf ?? source.oneOf;
  if (Array.isArray(variants) && Array.isArray(target.anyOf)) {
    const sent = target.anyOf as unknown[];
    variants.forEach((variant: unknown, index) => {
      const counterpart = sent[index];
      if (isNode(variant) && isNode(counterpart)) restoreClosedSets(variant, counterpart);
    });
  }
}

/**
 * The output format for a schema.
 *
 * `zodOutputFormat` alone is not safe to send. In SDK 0.131.0 its schema
 * transform has no case for `enum` or `const`, so it moves them into the
 * description as text: `{"type":"string","description":"{enum: [...]}"}`. The
 * API supports both and would have enforced them, but it was only ever given a
 * hint. On a real run the model wrote a value outside `verification`'s set and
 * the whole mission was discarded after every call had been paid for.
 *
 * `router.test.ts` fails if a closed set stops reaching the wire, so an SDK
 * upgrade that changes this is caught rather than silently regressing.
 */
export function structuredOutputFormat(schema: z.ZodType): {
  type: "json_schema";
  schema: JsonSchemaNode;
} {
  const sent = structuredClone(zodOutputFormat(schema).schema) as JsonSchemaNode;
  // The same options the SDK helper uses, so the two trees have the same shape.
  restoreClosedSets(z.toJSONSchema(schema, { reused: "ref" }) as JsonSchemaNode, sent);
  return { type: "json_schema", schema: sent };
}

export interface CompleteResult {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * One model call. Returns raw text — callers parse/validate against a Zod
 * schema themselves (see ./schemas).
 */
export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
  const tier = opts.tier ?? STAGE_TIER[opts.stage] ?? "standard";
  const model = MODELS[tier];
  const maxTokens = opts.maxTokens ?? 4096;
  const effort = TIER_EFFORT[tier];
  const outputConfig = {
    ...(effort === undefined ? {} : { effort }),
    ...(opts.schema === undefined ? {} : { format: structuredOutputFormat(opts.schema) }),
  };
  const request = {
    model,
    max_tokens: maxTokens,
    // Only sent where the model accepts it; see ACCEPTS_SAMPLING.
    ...(ACCEPTS_SAMPLING[tier] ? { temperature: opts.temperature ?? 0.4 } : {}),
    // Only sent where the model accepts it; see TIER_EFFORT.
    ...(Object.keys(outputConfig).length === 0 ? {} : { output_config: outputConfig }),
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.user }],
  };
  // `create`, never `parse`: `parse` validates before returning, so a truncated
  // response would surface as a parse failure and the check below would not run.
  // Callers validate with `parseStageJson`.
  const res = await getClient().messages.create(request, { signal: opts.signal });

  // Check why the model stopped before trusting what it wrote. A response cut
  // off at the budget used to surface as a baffling JSON parse error in a later
  // stage; a refusal used to be read as if it were content.
  if (res.stop_reason === "max_tokens") {
    throw new ModelOutputError(
      opts.stage,
      "truncated",
      `[${opts.stage}] output truncated at max_tokens=${maxTokens}`,
    );
  }
  if (res.stop_reason === "refusal") {
    throw new Error(`[${opts.stage}] the model declined the request`);
  }

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    model,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
  };
}

/** True when the pipeline can actually run. The harness checks this before starting. */
export function canGenerate(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Which model a stage will use, without making a call — for cost/attribution tracking. */
export function modelForStage(stage: StageName): string {
  return MODELS[STAGE_TIER[stage] ?? "standard"];
}
