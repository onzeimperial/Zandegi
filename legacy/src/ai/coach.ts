import { aiConfig } from "./config";
import { generateJson, AiValidationError } from "./client";
import { buildCoachSystem } from "./prompts";
import { coachReplySchema, type CoachReply } from "./schemas";
import { buildCoachContext, type CoachContext } from "./context";

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachResult {
  reply: CoachReply;
  provider: "ai" | "heuristic";
  model: string | null;
  context: CoachContext;
  usage?: { input: number; output: number };
  fallbackReason?: string;
}

export async function runCoach(params: {
  userId: string;
  goalId?: string;
  message: string;
  history?: CoachTurn[];
}): Promise<CoachResult> {
  const context = await buildCoachContext(params.userId, params.goalId);

  if (!aiConfig.enabled) {
    return { reply: heuristicCoach(params.message, context), provider: "heuristic", model: null, context };
  }

  const history = (params.history ?? []).slice(-8);
  const prompt = [
    `USER DATA SNAPSHOT (JSON):`,
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    history.length ? `\nRecent conversation:\n${history.map((h) => `${h.role.toUpperCase()}: ${h.content}`).join("\n")}` : "",
    `\nUSER'S MESSAGE: ${params.message}`,
  ].join("\n");

  try {
    const { data, usage } = await generateJson({
      schema: coachReplySchema,
      system: buildCoachSystem(),
      prompt,
      model: aiConfig.model,
      temperature: 0.5,
    });
    return { reply: data, provider: "ai", model: aiConfig.model, context, usage };
  } catch (err) {
    const fallbackReason =
      err instanceof AiValidationError ? "AI response failed validation" : err instanceof Error ? err.message : "AI error";
    return { reply: heuristicCoach(params.message, context), provider: "heuristic", model: null, context, fallbackReason };
  }
}

/**
 * Rules-based coach. Not motivational filler — it reads the same context object
 * and answers the most common questions with real numbers.
 */
export function heuristicCoach(message: string, ctx: CoachContext): CoachReply {
  const m = message.toLowerCase();
  const focusToday: string[] = [];
  const recommendations: CoachReply["recommendations"] = [];

  const allOpen = ctx.goals.flatMap((g) => g.openTasks.map((t) => ({ ...t, goalTitle: g.title })));
  const byPriority = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  allOpen.sort((a, b) => (byPriority[a.priority as keyof typeof byPriority] ?? 2) - (byPriority[b.priority as keyof typeof byPriority] ?? 2));

  for (const t of allOpen.slice(0, 3)) focusToday.push(`${t.title} (${t.goalTitle})`);

  const weakest = ctx.goals
    .flatMap((g) => g.skills.map((s) => ({ ...s, goal: g.title })))
    .sort((a, b) => a.mastery - b.mastery)[0];

  let reply = "";

  if (/what.*(today|now|do next)/.test(m) || /^(help|start|go)$/.test(m.trim())) {
    reply =
      focusToday.length > 0
        ? `Here's where I'd start today, highest-leverage first:\n\n${focusToday.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nYou've been active ${ctx.recentActivity.activeDaysLast14}/14 recent days and your streak is ${ctx.streak.current}. Protect the streak first, then do the top task.`
        : `You have no open tasks right now. Add a goal or generate this week's tasks from a goal page, and I'll prioritise them for you.`;
  } else if (/weak|worst|struggl|stuck/.test(m)) {
    reply = weakest
      ? `Your weakest area is **${weakest.name}** (${weakest.goal}) at ${weakest.mastery}% mastery, confidence ${weakest.confidence}%. Put your next 2 sessions there. Being "stuck" is usually a missing sub-skill or no feedback loop — do one timed practice set and review every mistake.`
      : `I don't have enough skill data yet. Complete a few tasks tagged to skills and I can pinpoint the weak spot.`;
    if (weakest) recommendations.push({ kind: "revise", title: `Focus ${weakest.name}`, body: `Two dedicated sessions on ${weakest.name}; review every error.`, priority: 2 });
  } else if (/pace|fast enough|on track|behind|by (june|july|\w+)|reach.*(goal|target)/.test(m)) {
    const g = ctx.goals[0];
    if (g?.timelineWeeks && g.targetDate) {
      reply = `For **${g.title}** you're at ${Math.round(g.progressPct)}% with a target date of ${g.targetDate}. At your recent rate (${ctx.recentActivity.activeDaysLast14}/14 active days) you're ${g.progressPct >= 50 ? "roughly on track" : "at risk of slipping"}. ${g.progressPct < 50 ? "Either add ~2 sessions/week or push the date." : "Keep the current cadence."}`;
    } else {
      reply = `Set a target date on your goal and log a week of tasks — then I can tell you if your pace gets you there.`;
    }
  } else if (/plan|revise|schedule|week/.test(m)) {
    reply = `This week: ${focusToday.length ? focusToday.join("; ") : "no tasks yet — generate them from a goal"}. Then do your weekly review to reset priorities.`;
  } else {
    reply = `I read your data: level ${ctx.account.level}, ${ctx.goals.length} active goal(s), streak ${ctx.streak.current}, ${ctx.recentActivity.completionsLast14Days} tasks done in 14 days. Ask me "what should I do today?", "what's my weakest skill?", or "am I on pace?" for specifics.\n\n(Connect an Anthropic API key for full conversational coaching.)`;
  }

  return { reply, focusToday, recommendations, proposedActions: [], confidence: 40 };
}
