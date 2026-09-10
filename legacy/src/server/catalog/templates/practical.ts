import type { TemplateDomain, TemplateSpec } from "../types";

interface Skill {
  slug: string;
  name: string;
  /** Why it's worth having. */
  why: string;
  /** The competence checkpoint. */
  proof: string;
  weeks: number;
  difficulty: number;
}

/** Everyday competences — the things adults are assumed to be able to do. */
const SKILLS: Skill[] = [
  { slug: "swim", name: "learn to swim", why: "It is a genuine safety skill, not just a leisure one", proof: "Swim 200m unaided and tread water", weeks: 24, difficulty: 3 },
  { slug: "ride-bike", name: "learn to ride a bike", why: "Never too late, and it opens up transport and leisure", proof: "Ride confidently on quiet roads", weeks: 10, difficulty: 2 },
  { slug: "cycle-commute", name: "start cycling to work", why: "Fitness and transport in the same half hour", proof: "Commute by bike consistently for a month", weeks: 12, difficulty: 2 },
  { slug: "motorcycle", name: "get a motorcycle licence", why: "Cheaper transport and a genuine skill", proof: "Pass the test and ride independently", weeks: 24, difficulty: 3 },
  { slug: "sew-repair", name: "learn to repair clothes", why: "Most clothes are thrown away over a two-minute fix", proof: "Repair five garments properly", weeks: 10, difficulty: 2 },
  { slug: "iron-properly", name: "learn to iron and care for clothes", why: "Clothes last far longer and look better", proof: "Care correctly for every fabric you own", weeks: 6, difficulty: 1 },
  { slug: "basic-plumbing", name: "handle basic plumbing", why: "Most call-outs are for jobs you could do", proof: "Fix a leak and replace a tap yourself", weeks: 10, difficulty: 2 },
  { slug: "basic-electrics", name: "understand your home's electrics safely", why: "Know what is safe to do and what is not", proof: "Safely handle the jobs a homeowner may do", weeks: 10, difficulty: 3 },
  { slug: "painting-decorating", name: "learn to paint and decorate properly", why: "Preparation is most of the result", proof: "Decorate a room to a professional standard", weeks: 12, difficulty: 2 },
  { slug: "car-maintenance", name: "maintain your own car", why: "Cheaper, and you notice problems early", proof: "Do a full service check yourself", weeks: 14, difficulty: 3 },
  { slug: "change-tyre", name: "handle roadside car problems", why: "Being stranded is mostly avoidable", proof: "Change a tyre and jump-start confidently", weeks: 6, difficulty: 1 },
  { slug: "tie-knots", name: "learn practical knots", why: "Useful constantly once you know them", proof: "Tie ten knots from memory for the right job", weeks: 8, difficulty: 1 },
  { slug: "public-transport-city", name: "navigate any city confidently", why: "Removes friction from travel and moving", proof: "Navigate an unfamiliar city without stress", weeks: 8, difficulty: 1 },
  { slug: "self-defence", name: "learn practical self-defence", why: "Awareness and confidence more than fighting", proof: "Respond effectively under pressure in training", weeks: 28, difficulty: 3 },
  { slug: "cpr", name: "learn CPR", why: "The single highest-impact skill on this list", proof: "Certified and confident to act", weeks: 4, difficulty: 1 },
  { slug: "fire-safety", name: "make your home fire-safe", why: "Cheap, quick and occasionally decisive", proof: "Home fully alarmed with a practised escape plan", weeks: 4, difficulty: 1 },
  { slug: "cyber-hygiene", name: "secure your digital life", why: "Most people are one breach from serious trouble", proof: "Unique passwords, 2FA and backups everywhere", weeks: 8, difficulty: 2 },
  { slug: "spot-scams", name: "learn to spot scams", why: "Scams are increasingly sophisticated", proof: "Confidently identify and verify suspicious contact", weeks: 6, difficulty: 1 },
  { slug: "negotiate", name: "learn to negotiate", why: "Applies to salary, rent, cars and contracts", proof: "Negotiate a real deal successfully", weeks: 16, difficulty: 3 },
  { slug: "complain-effectively", name: "learn to complain effectively", why: "Knowing the process changes the outcome", proof: "Resolve a real dispute in your favour", weeks: 8, difficulty: 2 },
  { slug: "read-contracts", name: "learn to read a contract", why: "You sign things that matter more than you think", proof: "Read a lease or contract and identify the risks", weeks: 10, difficulty: 3 },
  { slug: "write-clearly", name: "learn to write clearly", why: "The highest-leverage professional skill there is", proof: "Write anything so it is understood first time", weeks: 20, difficulty: 3 },
  { slug: "spreadsheets", name: "get properly good at spreadsheets", why: "Quietly one of the most useful work skills", proof: "Build a working model with formulas and pivots", weeks: 14, difficulty: 2 },
  { slug: "presentations", name: "make presentations that don't bore people", why: "Most presentations fail on structure, not slides", proof: "Deliver a presentation people actually follow", weeks: 12, difficulty: 2 },
  { slug: "emails", name: "write emails people actually read", why: "Small skill, enormous daily payoff", proof: "Consistently get quick, clear replies", weeks: 6, difficulty: 1 },
  { slug: "meetings", name: "run meetings worth attending", why: "Badly run meetings waste more time than anything", proof: "Run meetings that end early with decisions made", weeks: 12, difficulty: 2 },
  { slug: "photograph-phone", name: "take good photos on your phone", why: "The camera you always have is the one that matters", proof: "Consistently take photos worth keeping", weeks: 10, difficulty: 2 },
  { slug: "cut-hair", name: "learn to cut hair", why: "Saves money and is genuinely useful", proof: "Cut hair to a standard people compliment", weeks: 16, difficulty: 2 },
  { slug: "sharpen-knives", name: "learn to sharpen knives properly", why: "Blunt knives are the dangerous ones", proof: "Take a blunt knife to shaving sharp", weeks: 6, difficulty: 2 },
  { slug: "wrap-gifts", name: "learn small hosting skills", why: "The small competences that make you good to be around", proof: "Host, wrap, cook and welcome without stress", weeks: 8, difficulty: 1 },
  { slug: "dance-social", name: "learn to dance socially", why: "Removes a common source of social dread", proof: "Dance comfortably at a wedding or party", weeks: 16, difficulty: 2 },
  { slug: "remember-names", name: "learn to remember names", why: "It genuinely changes how people respond to you", proof: "Remember names reliably after one introduction", weeks: 10, difficulty: 2 },
  { slug: "handwriting", name: "improve your handwriting", why: "Legible handwriting still matters more than expected", proof: "Consistently legible and pleasant to read", weeks: 12, difficulty: 2 },
  { slug: "mental-map", name: "learn to navigate without a phone", why: "Useful, and it rebuilds a skill most people lost", proof: "Navigate an unfamiliar area from a map alone", weeks: 12, difficulty: 2 },
  { slug: "budgeting-basics", name: "learn to manage a household budget", why: "The foundation of every other financial goal", proof: "Run a household budget for three months", weeks: 14, difficulty: 2 },
  { slug: "diy-toolkit", name: "assemble and use a proper toolkit", why: "Having the right tool is most of the job", proof: "Own and confidently use a full basic toolkit", weeks: 8, difficulty: 1 },
];

function learnSkill(s: Skill): TemplateSpec {
  return {
    key: `practical-${s.slug}`,
    title: s.name.charAt(0).toUpperCase() + s.name.slice(1),
    summary: `${s.why}. A short, practical plan to get genuinely competent.`,
    category: "general",
    difficulty: s.difficulty,
    weeks: s.weeks,
    tags: [s.slug.replace(/-/g, " "), "practical", "life skill", "everyday", "useful"],
    skills: ["Fundamentals", "Guided practice", "Doing it for real", "Troubleshooting"],
    milestones: ["Basics understood", "First supervised or careful attempt", "Doing it unaided", s.proof],
  };
}

export const practical: TemplateDomain = {
  key: "practical",
  label: "Practical life skills",
  blurb: "The everyday competences that make life cheaper, safer and less stressful.",
  templates: SKILLS.map(learnSkill),
};
