/**
 * Stage 4 — Plan (SPEC §2.2). Chapters + exit conditions, sized to the
 * user's real time budget. Produces skeletons only (no steps yet — stage 5
 * details each chapter separately so it can stream).
 */

import { complete } from "../router";
import { personDetailsBlock, PERSON_DETAILS_RULE } from "../person-context";
import { parseStageJson, planOutputSchema } from "../schemas";
import type { Interpretation, ResolvedPursuit } from "../types";

const SYSTEM = `You plan a mission for Zandegi, a life-RPG app. Given a user's goal and its
classification, produce 3-7 chapters — meaningful phases, each with a real exit condition (a
concrete, checkable state, not "click next"). Size the plan to the user's actual weekly time
budget: don't plan a marathon-in-6-weeks program for someone with 2 hours a week.

Treat the time budget and any deadline as fixed. Start from where the person actually is and skip
what they have already done; build on what they can put toward this; work around what they say
the plan must work around; let their reason shape what the chapters emphasise. If the time and date
are a tight fit, say the plan is tight and order chapters so the most valuable work comes first.
The plan may be called tight; the person is never judged, and nothing says the goal is out of reach.

${PERSON_DETAILS_RULE}

Output ONLY a JSON object, no prose, no markdown fence:
{
  "missionTitle": string (short, specific, names the actual goal),
  "primaryDomain": one of "Mind" | "Edge" | "Coin" | "Body" | "Grit" | "Craft" | "Bond" | "World",
  "chapters": [
    { "title": string, "exitCondition": string (concrete and checkable) },
    ... 3 to 7 of these, in a sensible build order
  ]
}`;

export async function plan(
  interpretation: Interpretation,
  resolved: ResolvedPursuit,
  signal?: AbortSignal,
) {
  const res = await complete({
    stage: "plan",
    system: SYSTEM,
    user:
      JSON.stringify({
        intent: interpretation.intent,
        goalType: interpretation.goalType,
        constraints: interpretation.constraints,
        timeBudgetMinutesPerWeek: interpretation.timeBudgetMinutesPerWeek,
        location: interpretation.location,
        domains: resolved.domains,
        effortBand: resolved.effortBand,
      }) + personDetailsBlock(interpretation.details),
    maxTokens: 1536,
    schema: planOutputSchema,
    signal,
  });
  return parseStageJson("plan", res.text, planOutputSchema);
}
