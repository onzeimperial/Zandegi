import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { aiConfig } from "./config";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!aiConfig.enabled) {
    throw new AiUnavailableError();
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: aiConfig.apiKey });
  }
  return _client;
}

export class AiUnavailableError extends Error {
  code = "ai_unavailable";
  constructor() {
    super("AI is not configured (ANTHROPIC_API_KEY missing)");
  }
}

export class AiValidationError extends Error {
  code = "ai_validation";
  constructor(
    message: string,
    public raw: string,
    public issues: unknown,
  ) {
    super(message);
  }
}

export interface GenTextOptions {
  system: string;
  messages: Anthropic.MessageParam[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Anthropic.Tool[];
}

export interface GenTextResult {
  text: string;
  stopReason: string | null;
  usage: { input: number; output: number };
  toolUses: Array<{ id: string; name: string; input: unknown }>;
  raw: Anthropic.Message;
}

export async function generateText(opts: GenTextOptions): Promise<GenTextResult> {
  const client = anthropic();
  const msg = await client.messages.create({
    model: opts.model ?? aiConfig.model,
    max_tokens: opts.maxTokens ?? aiConfig.maxTokens,
    temperature: opts.temperature ?? 0.4,
    system: opts.system,
    messages: opts.messages,
    ...(opts.tools ? { tools: opts.tools } : {}),
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const toolUses = msg.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  return {
    text,
    stopReason: msg.stop_reason,
    usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
    toolUses,
    raw: msg,
  };
}

/**
 * Ask the model for JSON matching `schema`. Uses a strict system instruction,
 * extracts the first JSON object, validates with Zod, and retries once with the
 * validation errors fed back to the model.
 */
export async function generateJson<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ data: T; usage: { input: number; output: number } }> {
  const jsonSystem = `${params.system}

You must reply with a SINGLE valid JSON object and nothing else — no prose, no markdown fences. The JSON must conform exactly to the schema described by the user.`;

  let lastRaw = "";
  let lastIssues: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? params.prompt
        : `${params.prompt}\n\nYour previous reply failed validation with these errors:\n${JSON.stringify(
            lastIssues,
            null,
            2,
          )}\n\nReturn corrected JSON only.`;

    const res = await generateText({
      system: jsonSystem,
      messages: [{ role: "user", content: userContent }],
      model: params.model,
      maxTokens: params.maxTokens,
      temperature: params.temperature ?? 0.2,
    });

    lastRaw = res.text;
    const json = extractJson(res.text);
    if (json !== null) {
      const parsed = params.schema.safeParse(json);
      if (parsed.success) {
        return { data: parsed.data, usage: res.usage };
      }
      lastIssues = parsed.error.issues;
    } else {
      lastIssues = [{ message: "No JSON object found in response" }];
    }
  }

  throw new AiValidationError("AI response did not match the expected schema", lastRaw, lastIssues);
}

/** Pull the first balanced JSON object/array out of a string. */
export function extractJson(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.search(/[[{]/);
  if (start === -1) return null;
  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
