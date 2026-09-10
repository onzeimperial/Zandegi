import { env, AI_ENABLED } from "@/lib/env";

export const aiConfig = {
  enabled: AI_ENABLED,
  apiKey: env.ANTHROPIC_API_KEY,
  model: env.ZANDEGI_AI_MODEL,
  fastModel: env.ZANDEGI_AI_MODEL_FAST,
  maxTokens: env.ZANDEGI_AI_MAX_TOKENS,
  /** Provider label surfaced in the UI so users know if a plan was AI- or rules-generated. */
  providerLabel: AI_ENABLED ? "ai" : "heuristic",
} as const;
