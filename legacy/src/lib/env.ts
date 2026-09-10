import { z } from "zod";

/**
 * Validated environment access. Import `env` anywhere on the server.
 * Never import this into a client component — it would leak secrets.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be a long random string (>=16 chars)")
    // allow a dev fallback so `npm run dev` works before you generate one
    .default("dev-only-insecure-secret-change-me-000000"),
  AUTH_URL: z.string().url().default("http://localhost:3000"),

  AUTH_GITHUB_ID: z.string().optional().default(""),
  AUTH_GITHUB_SECRET: z.string().optional().default(""),
  AUTH_GOOGLE_ID: z.string().optional().default(""),
  AUTH_GOOGLE_SECRET: z.string().optional().default(""),

  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ZANDEGI_AI_MODEL: z.string().default("claude-sonnet-5"),
  ZANDEGI_AI_MODEL_FAST: z.string().default("claude-haiku-4-5-20251001"),
  ZANDEGI_AI_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  ZANDEGI_AI_RATE_LIMIT: z.coerce.number().int().positive().default(20),

  ZANDEGI_KNOWLEDGE_SEARCH_API_KEY: z.string().optional().default(""),
  ZANDEGI_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  // Fail fast and loudly — a misconfigured server should not boot.
  throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
}

export const env = parsed.data;

/** Whether live AI is available. When false, the app uses the heuristic planner. */
export const AI_ENABLED = env.ANTHROPIC_API_KEY.trim().length > 0;

export const ALLOWED_ORIGINS = env.ZANDEGI_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
