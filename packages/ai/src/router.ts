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
import type { z } from "zod";
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
   * outputs), so the model cannot emit malformed JSON. Asking for "ONLY a JSON
   * object" as free text failed on real output: one unescaped quote inside a
   * step's guide discarded a whole seven-chapter mission and every call already
   * paid for. The caller still validates with Zod, because rules such as domain
   * weights summing to 1 cannot be expressed in JSON Schema.
   */
  schema?: z.ZodType;
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
    ...(opts.schema === undefined ? {} : { format: zodOutputFormat(opts.schema) }),
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
  const res =
    opts.schema === undefined
      ? await getClient().messages.create(request, { signal: opts.signal })
      : await getClient().messages.parse(request, { signal: opts.signal });

  // Check why the model stopped before trusting what it wrote. A response cut
  // off at the budget used to surface as a baffling JSON parse error in a later
  // stage; a refusal used to be read as if it were content.
  if (res.stop_reason === "max_tokens") {
    throw new Error(`[${opts.stage}] output truncated at max_tokens=${maxTokens}`);
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
