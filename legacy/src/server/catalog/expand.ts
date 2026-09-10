import type { GoalPlan } from "@/ai/schemas";
import type { TemplateSpec } from "./types";

/**
 * Expand a compact TemplateSpec into a full GoalPlan.
 *
 * This is what makes the catalogue worth having: heuristicDecompose() has to
 * guess a category from keywords and then falls back to generic five-step
 * templates, whereas a catalogue entry supplies the real skills and
 * milestones for that specific goal. Task generation mirrors the heuristic so
 * plans from both paths feel consistent.
 */

export interface ExpandOptions {
  dailyMinutes: number;
  weeklyDays: number;
  /** Overrides the template's typical duration, e.g. from a user target date. */
  timelineWeeks?: number | null;
}

export function templateToPlan(spec: TemplateSpec, opts: ExpandOptions): GoalPlan {
  const difficulty = clampInt(spec.difficulty, 1, 5);
  const timelineWeeks = Math.max(1, Math.round(opts.timelineWeeks || spec.weeks));
  const targetLevel = 8 + difficulty * 4; // matches heuristicDecompose
  const weeklyMinutes = opts.dailyMinutes * opts.weeklyDays;

  const skillNames = spec.skills.length ? spec.skills : ["Fundamentals", "Deliberate practice"];
  const milestoneNames = spec.milestones.length ? spec.milestones : ["Started", "Achieved"];

  const skills = skillNames.map((name, i) => ({
    name,
    description: `Build "${name.toLowerCase()}" as part of: ${spec.title}`,
    category: spec.category,
    parent: null as string | null,
    startingConfidence: 40,
    // Chain the opening skills so the tree has real structure without
    // forcing a strict order through the whole plan.
    prerequisites: i > 0 && i < 3 ? [skillNames[i - 1]!] : [],
  }));

  const milestones = milestoneNames.map((title, i) => ({
    title,
    description: `Checkpoint ${i + 1} of ${milestoneNames.length} toward: ${spec.title}`,
    targetLevel: Math.round(((i + 1) / milestoneNames.length) * targetLevel),
    etaWeeks: Math.round(((i + 1) / milestoneNames.length) * timelineWeeks),
  }));

  const perSession = Math.max(15, Math.min(opts.dailyMinutes, 60));
  const recurring = opts.weeklyDays >= 5;
  const firstSkill = skills[0]!;
  const firstMilestone = milestones[0]!;

  const tasks: GoalPlan["tasks"] = [
    {
      title: "Write a 1-paragraph baseline: where am I now and why this goal matters",
      description: "Anchors your starting point so progress is measurable.",
      type: "once",
      skill: firstSkill.name,
      milestone: firstMilestone.title,
      difficulty: 1,
      estimatedMinutes: 15,
      priority: "high",
      recurrence: null,
    },
  ];

  for (const s of skills) {
    tasks.push({
      title: `First pass at ${s.name.toLowerCase()}`,
      description: `Spend one focused session getting oriented in ${s.name.toLowerCase()}.`,
      type: "once",
      skill: s.name,
      milestone: firstMilestone.title,
      difficulty: 2,
      estimatedMinutes: perSession,
      priority: "medium",
      recurrence: null,
    });
    tasks.push({
      title: `Practice: ${s.name.toLowerCase()}`,
      description: `Recurring deliberate practice on ${s.name.toLowerCase()}. Track what was hard.`,
      type: recurring ? "daily" : "weekly",
      skill: s.name,
      milestone: null,
      difficulty: 3,
      estimatedMinutes: perSession,
      priority: "medium",
      recurrence: recurring ? "FREQ=DAILY" : "FREQ=WEEKLY",
    });
  }

  tasks.push({
    title: "Weekly review: log progress, adjust next week's focus",
    description: "Update skill confidence, check milestone ETA, pick next week's priority.",
    type: "weekly",
    skill: null,
    milestone: null,
    difficulty: 2,
    estimatedMinutes: 20,
    priority: "high",
    recurrence: "FREQ=WEEKLY",
  });

  return {
    needsClarification: false,
    title: spec.title,
    summary: `${spec.summary} Planned over ~${timelineWeeks} weeks at roughly ${weeklyMinutes} min/week, from the Zandegi goal catalogue.`,
    category: spec.category,
    difficulty,
    // Higher than the keyword heuristic's 45: these skills and milestones were
    // written for this specific goal rather than inferred from a regex match.
    confidence: 70,
    startLevel: 1,
    targetLevel,
    recommendedTimelineWeeks: timelineWeeks,
    metric: spec.metric
      ? {
          name: spec.metric.name,
          start: 0,
          target: spec.metric.target,
          unit: spec.metric.unit ?? "",
        }
      : null,
    milestones,
    skills,
    // Schema caps tasks at 40; large skill lists could otherwise overflow.
    tasks: tasks.slice(0, 40),
    resources: [],
    habits: [
      `Show up ${opts.weeklyDays} days/week for ~${opts.dailyMinutes} minutes`,
      "End each session by noting one thing to do next time",
    ],
    risks: [
      "Losing consistency after the first two weeks",
      "Practising only strengths and avoiding weak areas",
      "No feedback loop to catch mistakes early",
    ],
    uncertainFacts: [],
  };
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}
