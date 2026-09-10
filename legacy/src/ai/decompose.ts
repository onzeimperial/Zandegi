import { aiConfig } from "./config";
import { generateJson, AiValidationError } from "./client";
import { ZANDEGI_PERSONA } from "./prompts";
import { buildDecompositionPrompt } from "./prompts";
import { decompositionResultSchema, type DecompositionResult, type GoalPlan } from "./schemas";
import { heuristicDecompose } from "./heuristic";
import { retrieveKnowledge, formatKnowledgeForPrompt } from "./knowledge";
import { normalisePlan, categoryLabel } from "./plan-normalize";

export { normalisePlan, categoryLabel };

export interface DecomposeInput {
  rawInput: string;
  dailyMinutes: number;
  weeklyDays: number;
  targetDate?: Date | null;
  clarificationAnswers?: string | null;
  /** Force the rules-based planner even if AI is configured. */
  preferHeuristic?: boolean;
}

export interface DecomposeOutput {
  result: DecompositionResult;
  provider: "ai" | "heuristic";
  model: string | null;
  /** Present when we fell back because the AI call failed. */
  fallbackReason?: string;
  usage?: { input: number; output: number };
}

export async function decomposeGoal(input: DecomposeInput): Promise<DecomposeOutput> {
  const heuristicResult = (): DecomposeOutput => ({
    result: heuristicDecompose({
      rawInput: input.rawInput,
      dailyMinutes: input.dailyMinutes,
      weeklyDays: input.weeklyDays,
      targetDate: input.targetDate ?? null,
    }),
    provider: "heuristic",
    model: null,
  });

  if (!aiConfig.enabled || input.preferHeuristic) {
    return heuristicResult();
  }

  // Pull versioned knowledge relevant to the goal (exam formats, etc.).
  let knowledgeBlock: string | null = null;
  try {
    const hits = await retrieveKnowledge({ text: input.rawInput, limit: 4 });
    knowledgeBlock = formatKnowledgeForPrompt(hits);
  } catch {
    /* knowledge is best-effort */
  }

  const prompt = buildDecompositionPrompt({
    rawInput: input.rawInput,
    dailyMinutes: input.dailyMinutes,
    weeklyDays: input.weeklyDays,
    targetDateISO: input.targetDate ? input.targetDate.toISOString().slice(0, 10) : null,
    clarationAnswers: input.clarificationAnswers ?? null,
    knowledge: knowledgeBlock,
  });

  try {
    const { data, usage } = await generateJson({
      schema: decompositionResultSchema,
      system: `${ZANDEGI_PERSONA}\n\nYou are decomposing a user's goal into a Zandegi progression plan.`,
      prompt,
      model: aiConfig.model,
      temperature: 0.3,
    });

    const normalised =
      "needsClarification" in data && data.needsClarification === true
        ? data
        : normalisePlan(data as GoalPlan);

    return {
      result: normalised,
      provider: "ai",
      model: aiConfig.model,
      usage,
    };
  } catch (err) {
    const reason =
      err instanceof AiValidationError
        ? "AI response failed schema validation"
        : err instanceof Error
          ? err.message
          : "Unknown AI error";
    return { ...heuristicResult(), fallbackReason: reason };
  }
}

