/**
 * Stage 2 — Resolve (SPEC §2.2). Picks a Pursuit or falls through to the
 * generic scaffold.
 *
 * No Pursuit catalog exists yet (BUILD-PROMPTS session 2 — 0 of 140 seeded),
 * so this always falls through to the generic scaffold
 * (`usedGenericScaffold: true`), exactly as SPEC §1.1 describes for anything
 * below the 0.62 confidence bar. It still does real work: classifying
 * domain weights, effort band, and — critically — `safetyClass`, since that
 * gates whether generation is even allowed to continue.
 */

import { complete } from "../router";
import { assertDomainWeights, type DomainWeight } from "@zandegi/core";
import { parseStageJson, resolveClassificationSchema } from "../schemas";
import type { Interpretation, ResolvedPursuit } from "../types";

const SYSTEM = `You classify a user's goal for Zandegi, a life-RPG app with 8 life domains: Mind
(learning, study, exams, languages), Edge (career, ambition, admissions, competition), Coin (money,
saving, investing, business), Body (strength, endurance, sport, sleep, nutrition), Grit (discipline,
habits, addiction recovery), Craft (skills, making, music, art, code, writing), Bond (family,
friendship, romance, community), World (travel, adventure, service, culture).

Output ONLY a JSON object, no prose, no markdown fence:
{
  "domains": { "<Domain>": number, ... } — weights in (0, 1] that sum to exactly 1, one or more domains,
  "effortBand": "SPRINT" | "SEASON" | "CAMPAIGN" | "LIFEWORK",
  "safetyClass": "NORMAL" | "CLINICAL" | "FINANCIAL" | "LEGAL" | "SELF_HARM_ADJACENT"
}

effortBand: SPRINT (days-weeks, narrow), SEASON (a few months), CAMPAIGN (6-18 months, substantial),
LIFEWORK (ongoing, no real end state).

safetyClass — be careful and conservative here, this gates real safety behaviour:
- CLINICAL: physical or mental health (weight loss, sleep, injury recovery, anxiety, addiction to a
  substance/behaviour with health dimensions)
- FINANCIAL: investing, debt, major money decisions
- LEGAL: anything involving legal process or rights
- SELF_HARM_ADJACENT: any goal expressing self-harm, suicidal ideation, or wanting to disappear/die —
  even phrased indirectly or minimised ("i want to die less", "make the pain stop")
- NORMAL: everything else`;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "goal"
  );
}

export async function resolve(interpretation: Interpretation): Promise<ResolvedPursuit> {
  const res = await complete({
    stage: "resolve",
    system: SYSTEM,
    user: JSON.stringify({
      intent: interpretation.intent,
      goalType: interpretation.goalType,
      constraints: interpretation.constraints,
    }),
    maxTokens: 512,
    temperature: 0.1,
  });
  const parsed = parseStageJson("resolve", res.text, resolveClassificationSchema);

  const domains = parsed.domains as DomainWeight;
  assertDomainWeights(domains);

  return {
    slug: slugify(interpretation.intent),
    domains,
    goalType: interpretation.goalType,
    effortBand: parsed.effortBand,
    safetyClass: parsed.safetyClass,
    // No seeded Pursuit exists to source a real prior from yet — neutral default (SPEC §4.1).
    difficultyPrior: 1.0,
    antiPatterns: [],
    usedGenericScaffold: true,
  };
}
