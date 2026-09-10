import type { GoalPlan } from "./schemas";
import type { GoalCategory } from "@/lib/constants";

/**
 * Deterministic, rules-based goal planner. Used when ANTHROPIC_API_KEY is not
 * set, or as a fallback when the model output fails validation. It is a real
 * planner (not a stub): it classifies the goal, picks a template, and adapts
 * timeline/task volume to the user's available time. The UI labels plans from
 * here as "heuristic" so users know AI refinement is available.
 */

interface HeuristicInput {
  rawInput: string;
  dailyMinutes: number;
  weeklyDays: number;
  targetDate?: Date | null;
}

const KEYWORDS: Array<{ cat: GoalCategory; words: RegExp }> = [
  { cat: "exam", words: /\b(ucat|lsat|gmat|gre|sat|mcat|imat|bmat|atar|hsc|vce|ib exam|a-?levels?|gcse|exam|test prep)\b/i },
  { cat: "programming", words: /\b(program(ming)?|cod(e|ing)|software|developer|python|javascript|typescript|react|rust|golang|leetcode|algorithms?|data structures?)\b/i },
  { cat: "language", words: /\b(spanish|french|german|mandarin|chinese|japanese|korean|italian|arabic|portuguese|language|fluent|duolingo|hsk|jlpt|delf)\b/i },
  { cat: "music", words: /\b(piano|guitar|violin|drums|sing(ing)?|music theory|compose|produce music|ableton|instrument)\b/i },
  { cat: "sport", words: /\b(basketball|football|soccer|tennis|swim(ming)?|running|marathon|5k|10k|cycling|climb(ing)?|boxing|martial arts|sport)\b/i },
  { cat: "fitness", words: /\b(gym|lift(ing)?|strength|muscle|weight loss|lose weight|body ?fat|calisthenics|fitness|pull-?ups?|bench press)\b/i },
  { cat: "business", words: /\b(startup|business|company|founder|mvp|customers?|revenue|saas|entrepreneur)\b/i },
  { cat: "finance", words: /\b(invest(ing)?|stocks?|portfolio|budget|savings?|financial|accounting|cfa)\b/i },
  { cat: "career", words: /\b(career|job|interview|promotion|resume|cv|get hired|become a|senior engineer|manager)\b/i },
  { cat: "creative", words: /\b(draw(ing)?|paint(ing)?|writ(e|ing)|novel|photography|design|illustrat|animation)\b/i },
  { cat: "research", words: /\b(research|thesis|dissertation|phd|paper|publish|literature review)\b/i },
  { cat: "certification", words: /\b(certification|certified|aws|azure|gcp|pmp|comptia|cissp|ccna)\b/i },
  { cat: "habit", words: /\b(habit|every day|daily|meditat(e|ion)|journal|wake up early|stop|quit|read more|screen time)\b/i },
  { cat: "education", words: /\b(learn|study|understand|master|course|degree|university|maths?|mathematics|physics|chemistry|biology|history|economics|medicine)\b/i },
  { cat: "project", words: /\b(build|make|create|launch|ship|project|portfolio site|app)\b/i },
];

function classify(text: string): GoalCategory {
  for (const k of KEYWORDS) if (k.words.test(text)) return k.cat;
  return "general";
}

const SKILL_TEMPLATES: Partial<Record<GoalCategory, string[]>> = {
  exam: ["Content mastery", "Timing & exam technique", "Practice-test analysis", "Weak-area remediation", "Test-day readiness"],
  programming: ["Language fundamentals", "Data structures", "Algorithms", "Project building", "Debugging & tooling", "System design"],
  language: ["Core vocabulary", "Grammar", "Listening", "Speaking", "Reading", "Writing"],
  music: ["Technique", "Sight-reading / ear", "Repertoire", "Music theory", "Performance"],
  sport: ["Fundamental technique", "Conditioning", "Tactical understanding", "Match/competition practice", "Recovery & mobility"],
  fitness: ["Programming & progressive overload", "Compound lifts technique", "Nutrition & recovery", "Conditioning", "Consistency & tracking"],
  business: ["Customer discovery", "Product / MVP", "Go-to-market", "Metrics & finance", "Operations"],
  finance: ["Foundations & terminology", "Analysis methods", "Portfolio construction", "Risk management", "Ongoing review"],
  career: ["Core role skills", "Portfolio / evidence", "Networking", "Interview performance", "Personal brand"],
  creative: ["Fundamentals", "Deliberate practice", "Style & voice", "Finishing work", "Sharing & feedback"],
  research: ["Literature command", "Methodology", "Data / experiments", "Writing", "Dissemination"],
  certification: ["Exam blueprint coverage", "Hands-on labs", "Practice exams", "Weak-domain review", "Exam logistics"],
  habit: ["Trigger design", "Minimum viable version", "Tracking & streaks", "Obstacle planning", "Identity reinforcement"],
  education: ["Foundational concepts", "Core theory", "Problem solving", "Application & projects", "Review & retention"],
  project: ["Scope & spec", "Core build", "Iteration & polish", "Testing", "Launch"],
  general: ["Clarify & baseline", "Core skill building", "Consistent practice", "Feedback & adjustment", "Consolidation"],
};

const MILESTONE_TEMPLATES: Partial<Record<GoalCategory, string[]>> = {
  exam: ["Diagnostic complete & baseline set", "All content covered once", "Consistent timing under pressure", "Scoring near target on full mocks", "Peak & taper for test day"],
  programming: ["Environment set up, first programs running", "Comfortable with core language + data structures", "Solved 50+ practice problems", "Shipped a non-trivial project", "Portfolio-ready, can pass a technical screen"],
  language: ["Survival phrases & 300 words", "Present/past tenses, 1000 words", "Hold a 5-minute conversation", "Consume native content with support", "Operate day-to-day without translation"],
  general: ["Baseline established", "Fundamentals in place", "Halfway checkpoint", "Target behaviours consistent", "Goal achieved & consolidated"],
};

export function heuristicDecompose(input: HeuristicInput): GoalPlan {
  const text = input.rawInput.trim();
  const category = classify(text);
  const weeklyMinutes = input.dailyMinutes * input.weeklyDays;

  // Difficulty heuristic: ambitious phrasing => harder. Kept region-neutral —
  // "top 1%" and "highest grade" generalise where specific score thresholds
  // (a 99 ATAR, a 2400 UCAT) only made sense in one country.
  const ambitious =
    /\b(become|master|expert|world[- ]class|professional|elite|top \d+%?|highest|first[- ]class|distinction|honou?rs|competition|olympiad|phd|doctorate|startup|multi-?year)\b/i.test(
      text,
    );
  const difficulty = ambitious ? (weeklyMinutes < 240 ? 5 : 4) : weeklyMinutes < 150 ? 3 : 2;

  // Timeline: bounded by target date if given, else by difficulty & throughput.
  let timelineWeeks = [8, 12, 20, 36, 72][difficulty - 1] ?? 16;
  if (input.targetDate) {
    const weeks = Math.max(1, Math.round((input.targetDate.getTime() - Date.now()) / (7 * 864e5)));
    timelineWeeks = weeks;
  }

  const skillNames = SKILL_TEMPLATES[category] ?? SKILL_TEMPLATES.general!;
  const milestoneNames = MILESTONE_TEMPLATES[category] ?? MILESTONE_TEMPLATES.general!;

  const targetLevel = 8 + difficulty * 4; // 12..28
  const skills = skillNames.map((name, i) => ({
    name,
    description: `Develop "${name.toLowerCase()}" as part of: ${text}`,
    category,
    parent: null as string | null,
    startingConfidence: 40,
    prerequisites: i > 0 && i < 3 ? [skillNames[i - 1]!] : [],
  }));

  const milestones = milestoneNames.map((title, i) => ({
    title,
    description: `Checkpoint ${i + 1} of ${milestoneNames.length} toward: ${text}`,
    targetLevel: Math.round(((i + 1) / milestoneNames.length) * targetLevel),
    etaWeeks: Math.round(((i + 1) / milestoneNames.length) * timelineWeeks),
  }));

  // Task backlog: 1 recurring practice task per skill + a first concrete action each.
  const perSession = Math.max(15, Math.min(input.dailyMinutes, 60));
  const tasks: GoalPlan["tasks"] = [];
  tasks.push({
    title: "Write a 1-paragraph baseline: where am I now and why this goal matters",
    description: "Anchors your starting point so progress is measurable.",
    type: "once",
    skill: skills[0]!.name,
    milestone: milestones[0]!.title,
    difficulty: 1,
    estimatedMinutes: 15,
    priority: "high",
    recurrence: null,
  });
  for (const s of skills) {
    tasks.push({
      title: `First pass at ${s.name.toLowerCase()}`,
      description: `Spend one focused session getting oriented in ${s.name.toLowerCase()}.`,
      type: "once",
      skill: s.name,
      milestone: milestones[0]!.title,
      difficulty: 2,
      estimatedMinutes: perSession,
      priority: "medium",
      recurrence: null,
    });
    tasks.push({
      title: `Practice: ${s.name.toLowerCase()}`,
      description: `Recurring deliberate practice on ${s.name.toLowerCase()}. Track what was hard.`,
      type: input.weeklyDays >= 5 ? "daily" : "weekly",
      skill: s.name,
      milestone: null,
      difficulty: 3,
      estimatedMinutes: perSession,
      priority: "medium",
      recurrence: input.weeklyDays >= 5 ? "FREQ=DAILY" : "FREQ=WEEKLY",
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
    title: toTitle(text),
    summary: `Heuristic plan for "${text}". Classified as ${category}. Estimated ${timelineWeeks} weeks at ~${weeklyMinutes} min/week. This plan was generated by Zandegi's rules-based planner — connect an Anthropic API key for an AI-tailored plan and coaching.`,
    category,
    difficulty,
    confidence: 45,
    startLevel: 1,
    targetLevel,
    recommendedTimelineWeeks: timelineWeeks,
    metric: extractMetric(text),
    milestones,
    skills,
    tasks,
    resources: [],
    habits: [
      `Show up ${input.weeklyDays} days/week for ~${input.dailyMinutes} minutes`,
      "End each session by noting one thing to do next time",
    ],
    risks: ["Losing consistency after the first two weeks", "Practising only strengths and avoiding weak areas", "No feedback loop to catch mistakes early"],
    uncertainFacts: [],
  };
}

function toTitle(s: string): string {
  const cleaned = s.replace(/^i (want to|need to|would like to|wanna)\s+/i, "").replace(/[.?!]+$/, "");
  const short = cleaned.length > 70 ? cleaned.slice(0, 67) + "…" : cleaned;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/**
 * Pull a numeric target out of free text. Deliberately generic: it matches a
 * number next to a unit or metric word rather than naming any one country's
 * exams, so "2400 on the UCAT", "a 3.8 GPA" and "90% in finals" all work.
 */
/** Units that carry their own meaning, so no metric word is needed. */
const UNIT = /(%|kg|lbs?|km|miles?|hours?|minutes?|words?|books?|reps?|pages?)/;

/** Metric words worth trusting when they sit next to a number. */
const METRIC_WORD =
  /(score|gpa|grade|average|rank|band|mark|points?|atar|ucat|lsat|gmat|gre|sat|act|mcat|ielts|toefl|hsk|jlpt|wpm|rating|elo)/;

function extractMetric(text: string): GoalPlan["metric"] {
  // "75 kg", "30 books", "90%"
  const withUnit = text.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${UNIT.source}\\b`, "i"));
  if (withUnit) {
    return {
      name: "Target",
      start: 0,
      target: Number(withUnit[1]),
      unit: withUnit[2]!.toLowerCase(),
    };
  }

  // "2400 on the UCAT", "90 in finals"
  const viaPreposition = text.match(
    /\b(\d+(?:\.\d+)?)\s*\+?\s*(?:on|in|for)\s+(?:the\s+)?([a-z]{2,20})\b/i,
  );
  if (viaPreposition) {
    return { name: titleCase(viaPreposition[2]!), start: 0, target: Number(viaPreposition[1]), unit: "" };
  }

  // "99 ATAR", "1500 rating" — number then metric word.
  const numberFirst = text.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*\\+?\\s*${METRIC_WORD.source}\\b`, "i"));
  if (numberFirst) {
    return { name: titleCase(numberFirst[2]!), start: 0, target: Number(numberFirst[1]), unit: "" };
  }

  // "a GPA of 3.8", "ATAR of 99" — metric word then number.
  const wordFirst = text.match(new RegExp(`\\b${METRIC_WORD.source}\\s*(?:of|:)?\\s*(\\d+(?:\\.\\d+)?)\\b`, "i"));
  if (wordFirst) {
    return { name: titleCase(wordFirst[1]!), start: 0, target: Number(wordFirst[2]), unit: "" };
  }

  return null;
}

function titleCase(s: string): string {
  return s.length <= 4 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
