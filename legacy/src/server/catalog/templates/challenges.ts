import type { TemplateDomain, TemplateSpec } from "../types";

interface Challenge {
  slug: string;
  /** Phrased as the challenge itself, e.g. "no alcohol". */
  what: string;
  title: string;
  summary: string;
  category: "habit" | "fitness" | "creative" | "personal_development" | "finance" | "education";
  /** The thing that actually makes people fail this one. */
  failureMode: string;
  tags: string[];
}

/**
 * Time-boxed challenges. These are deliberately short and binary — you either
 * kept the streak or you didn't — which makes them the most game-like goals in
 * the catalogue. Each is offered at 30 and 100 days.
 */
const CHALLENGES: Challenge[] = [
  { slug: "no-alcohol", what: "no alcohol", title: "Go alcohol-free", summary: "A clean break from drinking, with social situations planned for in advance.", category: "habit", failureMode: "Unplanned social events", tags: ["alcohol", "sober", "dry"] },
  { slug: "no-sugar", what: "no added sugar", title: "Cut added sugar", summary: "Remove added sugar and notice what it actually changes.", category: "habit", failureMode: "Hidden sugar in everyday food", tags: ["sugar", "diet", "nutrition"] },
  { slug: "no-social-media", what: "no social media", title: "Quit social media", summary: "A full break from feeds, with the apps genuinely removed.", category: "habit", failureMode: "Reinstalling 'just to check something'", tags: ["social media", "digital", "attention"] },
  { slug: "no-spending", what: "no non-essential spending", title: "Spend nothing but essentials", summary: "A hard freeze on discretionary spending to reset your baseline.", category: "finance", failureMode: "Redefining wants as needs", tags: ["spending", "budget", "money"] },
  { slug: "no-takeaway", what: "no takeaway food", title: "Cook everything yourself", summary: "No delivery, no takeaway — every meal cooked at home.", category: "habit", failureMode: "Tired evenings with nothing prepped", tags: ["cooking", "takeaway", "food"] },
  { slug: "no-complaining", what: "no complaining", title: "Stop complaining", summary: "Notice how often you complain, then stop doing it.", category: "personal_development", failureMode: "Not noticing you're doing it", tags: ["complaining", "mindset", "attitude"] },
  { slug: "no-phone-morning", what: "no phone for the first hour", title: "Phone-free mornings", summary: "Keep the first hour of the day free of your phone entirely.", category: "habit", failureMode: "Using the phone as an alarm", tags: ["phone", "morning", "focus"] },
  { slug: "no-snooze", what: "no snoozing", title: "Never hit snooze", summary: "Get up the first time the alarm goes, every day.", category: "habit", failureMode: "Deciding in a half-asleep state", tags: ["morning", "alarm", "discipline"] },
  { slug: "cold-shower", what: "a cold shower every day", title: "Cold shower every day", summary: "A daily dose of deliberate discomfort.", category: "habit", failureMode: "Skipping on cold mornings", tags: ["cold shower", "discipline", "discomfort"] },
  { slug: "daily-walk", what: "a walk every day", title: "Walk every single day", summary: "A daily walk regardless of weather, mood or schedule.", category: "fitness", failureMode: "Leaving it until it's dark and raining", tags: ["walking", "movement", "outdoors"] },
  { slug: "daily-exercise", what: "exercise every day", title: "Move every day", summary: "Some deliberate physical activity daily, however small.", category: "fitness", failureMode: "All-or-nothing thinking on busy days", tags: ["exercise", "movement", "fitness"] },
  { slug: "daily-reading", what: "reading every day", title: "Read every day", summary: "A fixed daily reading commitment, however short.", category: "habit", failureMode: "Leaving it until you're too tired", tags: ["reading", "books", "habit"] },
  { slug: "daily-writing", what: "writing every day", title: "Write every day", summary: "Words on a page daily, without editing as you go.", category: "creative", failureMode: "Waiting for something worth writing", tags: ["writing", "creative", "daily"] },
  { slug: "daily-drawing", what: "drawing every day", title: "Draw every day", summary: "One drawing a day, finished or not, good or not.", category: "creative", failureMode: "Perfectionism stopping you starting", tags: ["drawing", "art", "creative"] },
  { slug: "daily-photo", what: "one photo every day", title: "Take a photo every day", summary: "One deliberate photograph a day — a project, not a snapshot.", category: "creative", failureMode: "Taking a lazy photo at 11pm", tags: ["photography", "creative", "daily"] },
  { slug: "daily-music", what: "practice every day", title: "Practise your instrument every day", summary: "Daily practice, even if only for ten minutes.", category: "habit", failureMode: "Setting an unrealistic session length", tags: ["music", "practice", "instrument"] },
  { slug: "daily-language", what: "language study every day", title: "Study a language every day", summary: "Daily contact with a language, however brief.", category: "education", failureMode: "Confusing app streaks with actual learning", tags: ["language", "study", "daily"] },
  { slug: "daily-meditation", what: "meditation every day", title: "Meditate every day", summary: "A daily sit, however restless it feels.", category: "habit", failureMode: "Judging the sessions and quitting", tags: ["meditation", "mindfulness", "calm"] },
  { slug: "daily-journal", what: "journalling every day", title: "Journal every day", summary: "Write something honest each day, for yourself only.", category: "habit", failureMode: "Trying to write something profound", tags: ["journal", "writing", "reflection"] },
  { slug: "daily-tidy", what: "ten minutes tidying every day", title: "Ten-minute daily tidy", summary: "A short daily reset that stops mess ever accumulating.", category: "habit", failureMode: "Letting one skipped day snowball", tags: ["tidying", "cleaning", "home"] },
  { slug: "daily-stretch", what: "stretching every day", title: "Stretch every day", summary: "Daily mobility work, which compounds faster than people expect.", category: "fitness", failureMode: "No fixed time slot", tags: ["stretching", "mobility", "flexibility"] },
  { slug: "daily-steps", what: "hitting a step target every day", title: "Hit your step target every day", summary: "A daily step floor you do not go below.", category: "fitness", failureMode: "Desk days with no plan", tags: ["steps", "walking", "activity"] },
  { slug: "daily-water", what: "drinking enough water every day", title: "Drink enough water every day", summary: "Hit a hydration target daily until it needs no thought.", category: "habit", failureMode: "No visible bottle or cue", tags: ["water", "hydration", "health"] },
  { slug: "daily-early", what: "waking early every day", title: "Wake up early every day", summary: "A fixed early wake time, weekends included.", category: "habit", failureMode: "Weekend lie-ins resetting your clock", tags: ["morning", "early", "sleep"] },
  { slug: "daily-gratitude", what: "noting gratitude every day", title: "Note something good every day", summary: "One specific good thing recorded daily.", category: "habit", failureMode: "Repeating the same generic things", tags: ["gratitude", "reflection", "positivity"] },
  { slug: "daily-connect", what: "contacting someone every day", title: "Reach out to someone every day", summary: "One genuine message or call a day to someone you care about.", category: "personal_development", failureMode: "Running out of easy people to contact", tags: ["connection", "friendship", "social"] },
  { slug: "daily-learn", what: "learning something every day", title: "Learn something new every day", summary: "Deliberate learning daily, recorded so it accumulates.", category: "education", failureMode: "Passive consumption instead of learning", tags: ["learning", "curiosity", "knowledge"] },
  { slug: "daily-deep-work", what: "one deep work block every day", title: "One deep work block every day", summary: "A protected, undistracted block of real work daily.", category: "habit", failureMode: "Meetings eating the block", tags: ["deep work", "focus", "productivity"] },
  { slug: "no-processed-food", what: "no ultra-processed food", title: "Cut ultra-processed food", summary: "Eat only minimally processed food and notice the difference.", category: "habit", failureMode: "Convenience food when short on time", tags: ["food", "processed", "nutrition"] },
  { slug: "no-caffeine", what: "no caffeine", title: "Quit caffeine", summary: "A full caffeine break, with the withdrawal week planned for.", category: "habit", failureMode: "The first three days of headaches", tags: ["caffeine", "coffee", "energy"] },
];

const DURATIONS = [
  { days: 30, weeks: 5, difficulty: 2, label: "30 days" },
  { days: 100, weeks: 15, difficulty: 4, label: "100 days" },
];

const templates: TemplateSpec[] = CHALLENGES.flatMap((c) =>
  DURATIONS.map((d): TemplateSpec => ({
    key: `challenge-${c.slug}-${d.days}`,
    title: `${c.title} for ${d.label}`,
    summary: `${c.summary} The usual reason people fail: ${c.failureMode.toLowerCase()} — so plan for that first.`,
    category: c.category,
    difficulty: d.difficulty,
    weeks: d.weeks,
    tags: [...c.tags, "challenge", `${d.days} days`, "streak"],
    skills: [
      "Planning for the known failure mode",
      "Daily trigger and tracking",
      "Getting back on after a slip",
      ...(d.days >= 100 ? ["Sustaining past the novelty"] : []),
    ],
    milestones:
      d.days === 30
        ? ["Day 3", "Day 7", "Day 14", "Day 30"]
        : ["Day 7", "Day 30", "Day 60", "Day 100"],
    metric: { name: "Days completed", target: d.days, unit: "days" },
  })),
);

export const challenges: TemplateDomain = {
  key: "challenges",
  label: "Challenges",
  blurb: "Short, binary, streak-based challenges — the most game-like goals here.",
  templates,
};
