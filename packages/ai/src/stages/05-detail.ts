/**
 * Stage 5 — Detail (SPEC §2.2). Steps, guides, tool attachments, estimated
 * minutes for one chapter. Called once per chapter by the orchestrator so
 * each chapter can be scored and streamed to the client as it lands (SPEC
 * §2.2's "progressive reveal").
 */

import { complete } from "../router";
import { personDetailsBlock, PERSON_DETAILS_RULE } from "../person-context";
import { parseStageJson, detailChapterOutputSchema } from "../schemas";
import type { Interpretation, ResolvedPursuit } from "../types";

const SYSTEM = `You detail one chapter of a Zandegi mission into concrete steps. Each step must be
doable in a single sitting. Output ONLY a JSON object, no prose, no markdown fence:

{
  "steps": [
    {
      "title": string,
      "estimatedMinutes": number (realistic, one sitting),
      "verification": "SELF" | "TIMER" | "ARTIFACT" | "METRIC" | "INTEGRATION",
      "guide": {
        "approach": string (how to actually do this step, specific and actionable today),
        "materials": string[] (what's needed, can be empty),
        "commonMistakes": string[] (can be empty),
        "whatGoodLooksLike": string (how the user knows they did it well)
      },
      "sources": [ { "title": string, "url"?: string, "date": string (ISO) } ]
        — REQUIRED if this step asserts any fact, price, requirement, deadline, or eligibility
        rule. Every hard factual claim must carry a dated source. If you don't have a real,
        verifiable source, do not assert the fact — phrase it as general advice instead and leave
        sources empty.
      "toolKinds": string[] (from: TRACKER, TIMER, CHECKLIST, TEMPLATE, CALCULATOR, PLANNER,
        LIBRARY, DRILL, JOURNAL, CAPTURE — only include ones that genuinely fit this step)
    },
    ... 2 to 9 of these
  ]
}

verification guide: SELF (user just says they did it — lowest bar, use sparingly), TIMER (a focus
session), ARTIFACT (photo/file proof), METRIC (a tracked number moved), INTEGRATION (a connected
app confirms it — only if genuinely plausible, e.g. a run via Strava).

Never invent a specific price, deadline, or eligibility rule you cannot source. Vague, general
advice needs no source; a specific hard claim does.

Write coaching as invitation, not obligation. An automated check treats the following as hard
factual claims and removes them from any step without a dated source, so phrase advice to avoid
them unless you are citing one:
- obligation words: "you must", "you need to", "you have to", "required", "requires",
  "minimum of", "mandatory", "eligible" — prefer "aim for", "try to", "it helps to", "consider"
- calendar dates, months or years, including the user's own goal date — say "before your goal
  date" or "in the weeks ahead" instead
- percentages, prices, and statistics such as "on average", "studies show", "X out of Y"
For example, write "Aim for three easy runs a week" rather than "You need a minimum of three runs
a week", and "Build up gradually before your goal date" rather than "Be race-ready by April".

Write steps for this person, not for anyone with this goal. Pitch each step from their starting
point, use what they can put toward this and name it where it helps, fit sittings to their weekly
time, and work around what they say the plan must work around. If time is tight, say the plan is
tight; the person is never judged, and nothing says the goal is out of reach.

${PERSON_DETAILS_RULE}`;

export interface DetailChapterInput {
  chapterTitle: string;
  exitCondition: string;
  interpretation: Interpretation;
  resolved: ResolvedPursuit;
}

export async function detailChapter(input: DetailChapterInput, signal?: AbortSignal) {
  const res = await complete({
    stage: "detail",
    system: SYSTEM,
    user:
      JSON.stringify({
        chapterTitle: input.chapterTitle,
        exitCondition: input.exitCondition,
        goalIntent: input.interpretation.intent,
        timeBudgetMinutesPerWeek: input.interpretation.timeBudgetMinutesPerWeek,
        currentLevel: input.interpretation.constraints.currentLevel,
        deadline: input.interpretation.constraints.deadline,
        resources: input.interpretation.constraints.resources,
        location: input.interpretation.location,
        domains: input.resolved.domains,
      }) + personDetailsBlock(input.interpretation.details),
    maxTokens: 6000,
    schema: detailChapterOutputSchema,
    signal,
  });
  return parseStageJson("detail", res.text, detailChapterOutputSchema);
}
