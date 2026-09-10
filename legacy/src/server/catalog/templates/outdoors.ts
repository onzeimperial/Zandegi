import type { TemplateDomain, TemplateSpec } from "../types";

interface OutdoorSkill {
  slug: string;
  name: string;
  /** The competence that keeps you safe doing it. */
  safety: string;
  /** The trip or feat that proves it. */
  proving: string;
  difficulty: number;
  weeks: number;
}

const PURSUITS: OutdoorSkill[] = [
  { slug: "hiking", name: "hiking", safety: "Navigation and weather judgement", proving: "Complete a full-day hike unaided", difficulty: 2, weeks: 16 },
  { slug: "backpacking", name: "multi-day backpacking", safety: "Load, food and shelter management", proving: "Complete a three-day trek", difficulty: 3, weeks: 24 },
  { slug: "wild-camping", name: "wild camping", safety: "Site selection and leave-no-trace", proving: "Camp two nights unsupported", difficulty: 3, weeks: 20 },
  { slug: "navigation", name: "map and compass navigation", safety: "Bearings and relocation", proving: "Navigate a route in poor visibility", difficulty: 3, weeks: 16 },
  { slug: "mountaineering", name: "mountaineering", safety: "Rope work and avalanche awareness", proving: "Summit an alpine peak with a guide", difficulty: 5, weeks: 60 },
  { slug: "scrambling", name: "scrambling", safety: "Exposure management and route finding", proving: "Complete a graded scramble", difficulty: 3, weeks: 24 },
  { slug: "trad-climbing", name: "trad climbing", safety: "Gear placement and anchor building", proving: "Lead a trad route safely", difficulty: 5, weeks: 52 },
  { slug: "winter-skills", name: "winter mountain skills", safety: "Ice axe, crampons and avalanche awareness", proving: "Complete a winter mountain day", difficulty: 4, weeks: 32 },
  { slug: "canyoning", name: "canyoning", safety: "Water hazard and abseil technique", proving: "Complete a guided canyon descent", difficulty: 4, weeks: 28 },
  { slug: "caving", name: "caving", safety: "Navigation underground and rope technique", proving: "Complete a vertical cave trip", difficulty: 4, weeks: 28 },
  { slug: "wild-swimming", name: "wild swimming", safety: "Cold water acclimatisation and hazard reading", proving: "Swim a distance in open water safely", difficulty: 2, weeks: 16 },
  { slug: "open-water-swimming", name: "open water swimming", safety: "Sighting and cold management", proving: "Complete a 2km open water swim", difficulty: 3, weeks: 24 },
  { slug: "scuba", name: "scuba diving", safety: "Buoyancy and dive planning", proving: "Qualify and dive independently", difficulty: 3, weeks: 20 },
  { slug: "freediving", name: "freediving", safety: "Breath-hold safety and never diving alone", proving: "Reach a target depth safely", difficulty: 4, weeks: 32 },
  { slug: "kitesurfing", name: "kitesurfing", safety: "Kite control and wind judgement", proving: "Ride upwind consistently", difficulty: 4, weeks: 28 },
  { slug: "windsurfing", name: "windsurfing", safety: "Sail handling and wind judgement", proving: "Sail upwind and return to shore", difficulty: 3, weeks: 24 },
  { slug: "paddleboarding", name: "paddleboarding", safety: "Wind and tide awareness", proving: "Complete a long coastal paddle", difficulty: 2, weeks: 12 },
  { slug: "white-water-kayaking", name: "white water kayaking", safety: "Roll and swiftwater awareness", proving: "Run a grade-3 river", difficulty: 4, weeks: 36 },
  { slug: "sea-kayaking", name: "sea kayaking", safety: "Tide, wind and rescue technique", proving: "Complete a coastal expedition day", difficulty: 3, weeks: 28 },
  { slug: "bikepacking", name: "bikepacking", safety: "Self-sufficiency and mechanical repair", proving: "Complete a multi-day bikepacking trip", difficulty: 3, weeks: 24 },
  { slug: "mountain-biking", name: "mountain biking", safety: "Body position and trail reading", proving: "Ride a red-graded trail confidently", difficulty: 3, weeks: 20 },
  { slug: "trail-running", name: "trail running", safety: "Foot placement and route planning", proving: "Complete a trail half marathon", difficulty: 3, weeks: 20 },
  { slug: "orienteering", name: "orienteering", safety: "Fast navigation under pressure", proving: "Complete a competitive course", difficulty: 3, weeks: 16 },
  { slug: "bushcraft", name: "bushcraft", safety: "Fire, shelter and water", proving: "Spend a night on skills alone", difficulty: 3, weeks: 24 },
  { slug: "foraging", name: "foraging", safety: "Certain identification and avoiding lookalikes", proving: "Forage and cook a meal safely", difficulty: 3, weeks: 24 },
  { slug: "fishing", name: "fishing", safety: "Water safety and regulations", proving: "Catch, prepare and cook a fish", difficulty: 2, weeks: 16 },
  { slug: "fly-fishing", name: "fly fishing", safety: "Casting technique and wading safety", proving: "Catch a fish on a fly you tied", difficulty: 3, weeks: 24 },
  { slug: "sailing-offshore", name: "offshore sailing", safety: "Passage planning and heavy weather", proving: "Complete an offshore passage", difficulty: 5, weeks: 52 },
  { slug: "paragliding", name: "paragliding", safety: "Weather judgement and canopy control", proving: "Fly solo with a licence", difficulty: 5, weeks: 44 },
  { slug: "skydiving", name: "skydiving", safety: "Canopy control and emergency procedures", proving: "Qualify for solo jumps", difficulty: 4, weeks: 32 },
  { slug: "horse-trekking", name: "horse trekking", safety: "Horsemanship and trail awareness", proving: "Complete a multi-day trek", difficulty: 3, weeks: 28 },
  { slug: "snowshoeing", name: "snowshoeing", safety: "Avalanche awareness and route choice", proving: "Complete a full winter day out", difficulty: 2, weeks: 12 },
  { slug: "ski-touring", name: "ski touring", safety: "Avalanche assessment and rescue", proving: "Complete a backcountry tour", difficulty: 4, weeks: 40 },
  { slug: "birdwatching", name: "birdwatching", safety: "Field identification skills", proving: "Identify 100 species by sight and sound", difficulty: 2, weeks: 32 },
  { slug: "stargazing", name: "stargazing", safety: "Sky orientation and equipment use", proving: "Find and observe 20 deep-sky objects", difficulty: 2, weeks: 20 },
];

function learnOutdoor(p: OutdoorSkill): TemplateSpec {
  return {
    key: `outdoors-${p.slug}`,
    title: `Learn ${p.name}`,
    summary: `Take up ${p.name} properly, with the judgement to stay safe — ${p.safety.toLowerCase()} matters more than gear.`,
    category: "sport",
    difficulty: p.difficulty,
    weeks: p.weeks,
    tags: [p.slug.replace(/-/g, " "), p.name, "outdoors", "adventure", "nature"],
    skills: ["Kit and preparation", p.safety, "Fitness for the activity", "Planning and conditions", "Building experience gradually"],
    milestones: ["Basics learned with instruction", "First independent outing", "Comfortable in normal conditions", p.proving],
  };
}

const generated = PURSUITS.map(learnOutdoor);

const extras: TemplateSpec[] = [
  {
    key: "outdoors-long-distance-trail",
    title: "Walk a long-distance trail",
    summary: "Train, plan and complete a named multi-week trail end to end.",
    category: "sport",
    difficulty: 4,
    weeks: 44,
    tags: ["thru-hike", "long distance", "trail", "hiking"],
    skills: ["Endurance training", "Kit selection and weight", "Resupply and logistics", "Foot care", "Mental endurance"],
    milestones: ["Trail chosen and planned", "Training hikes completed", "Kit tested on a shakedown trip", "Trail completed"],
  },
  {
    key: "outdoors-climb-mountain",
    title: "Climb a named mountain",
    summary: "Train for and summit a specific peak safely, with a real turnaround plan.",
    category: "sport",
    difficulty: 4,
    weeks: 36,
    tags: ["mountain", "summit", "climbing", "hiking"],
    skills: ["Endurance and altitude preparation", "Route and weather planning", "Technical skills for the route", "Turnaround discipline"],
    milestones: ["Peak chosen and route researched", "Training benchmarks hit", "Practice ascents completed", "Summit reached and returned safely"],
  },
  {
    key: "outdoors-camping-basics",
    title: "Learn to camp comfortably",
    summary: "The skills that separate a good night outside from a miserable one.",
    category: "general",
    difficulty: 1,
    weeks: 10,
    tags: ["camping", "outdoors", "beginner", "tent"],
    skills: ["Kit selection", "Pitching and site choice", "Camp cooking", "Staying warm and dry"],
    milestones: ["Kit sorted", "First night out", "Comfortable in poor weather", "Camping is genuinely enjoyable"],
  },
  {
    key: "outdoors-wilderness-first-aid",
    title: "Get wilderness first aid trained",
    summary: "First aid for when help is hours away rather than minutes.",
    category: "certification",
    difficulty: 3,
    weeks: 12,
    tags: ["first aid", "wilderness", "safety", "certification"],
    skills: ["Remote casualty assessment", "Improvised treatment", "Evacuation decisions", "Certification"],
    milestones: ["Course booked", "Course completed", "Skills practised in the field", "Certification current"],
  },
  {
    key: "outdoors-cold-water",
    title: "Build cold water tolerance safely",
    summary: "Progressive, safe acclimatisation rather than shocking yourself into it.",
    category: "habit",
    difficulty: 3,
    weeks: 20,
    tags: ["cold water", "swimming", "acclimatisation", "resilience"],
    skills: ["Progressive exposure", "Breathing control", "Recognising cold shock and afterdrop", "Never swimming alone"],
    milestones: ["Regular cold showers", "First short open water dip", "Ten minutes comfortable", "Swimming through a cold season"],
  },
  {
    key: "outdoors-leave-no-trace",
    title: "Learn to travel without leaving a trace",
    summary: "The ethics and practical skills of using wild places without degrading them.",
    category: "education",
    difficulty: 1,
    weeks: 8,
    tags: ["leave no trace", "ethics", "conservation", "outdoors"],
    skills: ["Waste and sanitation", "Campsite selection", "Fire and cooking practice", "Wildlife and vegetation care"],
    milestones: ["Principles learned", "Applied on a trip", "Habitual across all trips", "Teaching others"],
  },
];

export const outdoors: TemplateDomain = {
  key: "outdoors",
  label: "Outdoors & adventure",
  blurb: "Hiking, climbing, water, snow and getting properly into wild places.",
  templates: [...generated, ...extras],
};
