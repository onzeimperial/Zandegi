/**
 * Stage 1 — Interpret (SPEC §2.2). Free text → structured intent.
 */

import { complete } from "../router";
import { localDate, personDetailsBlock, PERSON_DETAILS_RULE } from "../person-context";
import { parseStageJson, interpretationOutputSchema } from "../schemas";
import type { GoalInput, Interpretation } from "../types";

const SYSTEM = `You are the intent interpreter for Zandegi, a life-RPG app. A user has typed a free-text
goal, however messy, vague, or misspelled. Extract structured intent from it. Output ONLY a JSON
object, no prose, no markdown fence, matching exactly this shape:

{
  "intent": string (one honest sentence restating what they actually want),
  "goalType": "OUTCOME" | "METRIC" | "HABIT" | "PROJECT" | "EXPERIENCE",
  "constraints": { "deadline"?: string (ISO date), "currentLevel"?: string, "resources"?: string[] },
  "timeBudgetMinutesPerWeek": number (infer a realistic default around 180 if not stated),
  "location"?: string,
  "notes": {
    "isVague"?: boolean (true if there's no concrete target or timeframe at all),
    "isImpossibleScope"?: boolean (true only if the goal itself is literally impossible in the
      stated/implied timeframe — e.g. "become a billionaire by March". A tight date or few hours
      is not impossible: leave this unset and let the plan make the most of what they have),
    "dependsOnVolatileFacts"?: boolean (true if it depends on facts that change over time —
      application windows, prices, eligibility rules, exam dates)
  }
}

Goal type guide (SPEC §1.3) — pick honestly, never force a metric onto something that doesn't have one:
- OUTCOME: no finite metric ("get into medicine")
- METRIC: a real measurable number ("bench 100kg", "save $30,000")
- HABIT: a recurring behaviour ("meditate daily")
- PROJECT: finite defined scope ("ship my app")
- EXPERIENCE: a one-off ("see the northern lights")

"today" in the input is today's date: resolve relative dates against it, and never output a deadline
before it. If the person states their hours, date or location, use those values. If they describe
their starting point or resources, reflect them in currentLevel and resources.

${PERSON_DETAILS_RULE}`;

export async function interpret(
  input: GoalInput,
  asOf: Date,
  signal?: AbortSignal,
): Promise<Interpretation> {
  const user =
    JSON.stringify({
      today: localDate(asOf, input.timezone),
      rawText: input.rawText,
      timezone: input.timezone,
      location: input.location,
      weeklyTimeBudgetMinutes: input.weeklyTimeBudgetMinutes,
    }) + personDetailsBlock(input.details);
  const res = await complete({
    stage: "interpret",
    system: SYSTEM,
    user,
    maxTokens: 1024,
    temperature: 0.2,
    schema: interpretationOutputSchema,
    signal,
  });
  const parsed = parseStageJson("interpret", res.text, interpretationOutputSchema);
  return {
    ...parsed,
    // No Pursuit catalog exists yet (BUILD-PROMPTS session 2) — nothing to match against.
    pursuitMatches: [],
  };
}
