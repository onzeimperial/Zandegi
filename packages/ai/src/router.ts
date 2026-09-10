/**
 * Model routing. **The only place the Anthropic SDK is constructed or
 * called** (CLAUDE.md §3) — no route, component, or other package touches it
 * directly.
 *
 * Each pipeline stage names its model here rather than hard-coding one, so
 * cost/quality tuning (session 10's cost model) happens in one file.
 */

import Anthropic from "@anthropic-ai/sdk";
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
  const res = await getClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.4,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

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
