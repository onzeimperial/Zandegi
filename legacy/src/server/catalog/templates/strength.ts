import type { TemplateDomain, TemplateSpec } from "../types";

interface Feat {
  slug: string;
  name: string;
  /** The limiting factor for this specific feat. */
  limiter: string;
  weeks: number;
  difficulty: number;
  metric?: { name: string; target: number; unit: string };
}

/** Specific, measurable physical feats — the kind people actually chase. */
const FEATS: Feat[] = [
  { slug: "muscle-up", name: "a muscle-up", limiter: "Explosive pulling and transition technique", weeks: 36, difficulty: 4 },
  { slug: "pistol-squat", name: "a pistol squat", limiter: "Single-leg strength and ankle mobility", weeks: 24, difficulty: 3 },
  { slug: "front-lever", name: "a front lever", limiter: "Straight-arm scapular strength", weeks: 44, difficulty: 5 },
  { slug: "planche", name: "a planche", limiter: "Straight-arm pushing strength", weeks: 60, difficulty: 5 },
  { slug: "human-flag", name: "a human flag", limiter: "Lateral core and shoulder strength", weeks: 52, difficulty: 5 },
  { slug: "l-sit", name: "a 30-second L-sit", limiter: "Compression strength and hamstring mobility", weeks: 20, difficulty: 3, metric: { name: "Hold", target: 30, unit: "sec" } },
  { slug: "handstand-pushup", name: "a handstand push-up", limiter: "Overhead pressing strength", weeks: 36, difficulty: 4 },
  { slug: "one-arm-pushup", name: "a one-arm push-up", limiter: "Unilateral pressing and anti-rotation", weeks: 40, difficulty: 4 },
  { slug: "hundred-pushups", name: "100 push-ups in one set", limiter: "Muscular endurance", weeks: 28, difficulty: 3, metric: { name: "Push-ups", target: 100, unit: "reps" } },
  { slug: "twenty-pullups", name: "20 consecutive pull-ups", limiter: "Pulling endurance and bodyweight ratio", weeks: 36, difficulty: 4, metric: { name: "Pull-ups", target: 20, unit: "reps" } },
  { slug: "deadlift-2x", name: "a double-bodyweight deadlift", limiter: "Posterior chain strength and technique", weeks: 44, difficulty: 4 },
  { slug: "deadlift-3x", name: "a triple-bodyweight deadlift", limiter: "Years of progressive loading", weeks: 104, difficulty: 5 },
  { slug: "overhead-press-bw", name: "a bodyweight overhead press", limiter: "Overhead strength and stability", weeks: 60, difficulty: 5 },
  { slug: "1000lb-club", name: "a 1000lb powerlifting total", limiter: "Balanced progress across three lifts", weeks: 80, difficulty: 5 },
  { slug: "snatch-bodyweight", name: "a bodyweight snatch", limiter: "Technique under speed", weeks: 80, difficulty: 5 },
  { slug: "sub-5-mile", name: "a sub-5-minute mile", limiter: "Speed endurance and VO2 max", weeks: 40, difficulty: 5, metric: { name: "Mile time", target: 5, unit: "min" } },
  { slug: "sub-20-5k", name: "a sub-20-minute 5K", limiter: "Threshold pace tolerance", weeks: 28, difficulty: 4, metric: { name: "5K time", target: 20, unit: "min" } },
  { slug: "sub-90-half", name: "a sub-90-minute half marathon", limiter: "Sustained threshold running", weeks: 36, difficulty: 4, metric: { name: "Half marathon", target: 90, unit: "min" } },
  { slug: "sub-3-marathon", name: "a sub-3-hour marathon", limiter: "High mileage tolerance and pacing", weeks: 52, difficulty: 5, metric: { name: "Marathon time", target: 180, unit: "min" } },
  { slug: "ultramarathon", name: "an ultramarathon", limiter: "Time on feet and fuelling", weeks: 52, difficulty: 5 },
  { slug: "ironman", name: "an Ironman triathlon", limiter: "Training volume across three sports", weeks: 60, difficulty: 5 },
  { slug: "olympic-triathlon", name: "an Olympic-distance triathlon", limiter: "Balancing three disciplines", weeks: 32, difficulty: 4 },
  { slug: "swim-mile", name: "a one-mile open water swim", limiter: "Sighting and sustained pace", weeks: 24, difficulty: 3 },
  { slug: "plank-5min", name: "a five-minute plank", limiter: "Isometric core endurance", weeks: 16, difficulty: 2, metric: { name: "Plank hold", target: 300, unit: "sec" } },
  { slug: "flexibility-pancake", name: "a full pancake stretch", limiter: "Hip and hamstring flexibility", weeks: 44, difficulty: 4 },
  { slug: "bridge", name: "a full back bridge", limiter: "Thoracic and shoulder mobility", weeks: 32, difficulty: 3 },
  { slug: "box-jump-high", name: "a high box jump", limiter: "Explosive power", weeks: 24, difficulty: 3 },
  { slug: "vertical-jump", name: "a significantly higher vertical jump", limiter: "Rate of force development", weeks: 32, difficulty: 4 },
  { slug: "dunk", name: "dunking a basketball", limiter: "Vertical jump and approach technique", weeks: 52, difficulty: 5 },
  { slug: "farmers-walk", name: "a heavy farmer's walk", limiter: "Grip and trunk endurance", weeks: 24, difficulty: 3 },
  { slug: "rope-climb", name: "a legless rope climb", limiter: "Pulling strength and grip", weeks: 32, difficulty: 4 },
  { slug: "run-streak", name: "a 100-day run streak", limiter: "Recovery management and consistency", weeks: 16, difficulty: 3, metric: { name: "Consecutive days", target: 100, unit: "days" } },
];

function achieveFeat(f: Feat): TemplateSpec {
  return {
    key: `strength-${f.slug}`,
    title: `Achieve ${f.name}`,
    summary: `A structured progression toward ${f.name}. The limiting factor is usually ${f.limiter.toLowerCase()}.`,
    category: "fitness",
    difficulty: f.difficulty,
    weeks: f.weeks,
    tags: [f.slug.replace(/-/g, " "), "strength", "training", "fitness", "goal"],
    skills: [f.limiter, "Progressive overload", "Technique refinement", "Recovery and deloads", "Consistent programming"],
    milestones: ["Baseline tested and programme chosen", "Prerequisite strength built", "Close to the target", `${f.name.charAt(0).toUpperCase() + f.name.slice(1)} achieved`],
    ...(f.metric ? { metric: f.metric } : {}),
  };
}

export const strength: TemplateDomain = {
  key: "strength",
  label: "Strength & feats",
  blurb: "Specific, measurable physical goals — lifts, calisthenics skills and race times.",
  templates: FEATS.map(achieveFeat),
};
