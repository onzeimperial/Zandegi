import type { TemplateDomain, TemplateSpec } from "../types";

interface Sport {
  slug: string;
  name: string;
  /** The technical skill that most distinguishes this sport. */
  technique: string;
  /** What "getting good" concretely looks like. */
  proving: string;
  team?: boolean;
}

const SPORTS: Sport[] = [
  { slug: "football", name: "football", technique: "Ball control and passing", proving: "Play a full competitive match", team: true },
  { slug: "basketball", name: "basketball", technique: "Shooting form and handles", proving: "Play in a competitive game", team: true },
  { slug: "tennis", name: "tennis", technique: "Groundstroke consistency", proving: "Win a competitive set" },
  { slug: "table-tennis", name: "table tennis", technique: "Spin control", proving: "Win a club-level match" },
  { slug: "badminton", name: "badminton", technique: "Footwork and net play", proving: "Win a club-level match" },
  { slug: "squash", name: "squash", technique: "Length and court movement", proving: "Win a club-level match" },
  { slug: "volleyball", name: "volleyball", technique: "Passing and setting", proving: "Play a full competitive match", team: true },
  { slug: "cricket", name: "cricket", technique: "Batting and bowling technique", proving: "Play a full innings", team: true },
  { slug: "rugby", name: "rugby", technique: "Contact skills and handling", proving: "Play a full competitive match", team: true },
  { slug: "hockey", name: "field hockey", technique: "Stick skills", proving: "Play a full competitive match", team: true },
  { slug: "netball", name: "netball", technique: "Passing and positioning", proving: "Play a full competitive match", team: true },
  { slug: "baseball", name: "baseball", technique: "Hitting and fielding", proving: "Play a full game", team: true },
  { slug: "golf", name: "golf", technique: "Swing consistency", proving: "Break 100 over 18 holes" },
  { slug: "boxing", name: "boxing", technique: "Guard, footwork and combinations", proving: "Spar three full rounds" },
  { slug: "muay-thai", name: "Muay Thai", technique: "Clinch and kicking technique", proving: "Spar three full rounds" },
  { slug: "bjj", name: "Brazilian jiu-jitsu", technique: "Guard and escapes", proving: "Compete in a tournament" },
  { slug: "judo", name: "judo", technique: "Grip fighting and throws", proving: "Compete in a tournament" },
  { slug: "karate", name: "karate", technique: "Kata and kumite technique", proving: "Grade to the next belt" },
  { slug: "taekwondo", name: "taekwondo", technique: "Kicking technique", proving: "Grade to the next belt" },
  { slug: "wrestling", name: "wrestling", technique: "Takedowns and scrambling", proving: "Compete in a tournament" },
  { slug: "fencing", name: "fencing", technique: "Distance and blade work", proving: "Win a competitive bout" },
  { slug: "archery", name: "archery", technique: "Draw consistency and aim", proving: "Shoot a qualifying score" },
  { slug: "climbing", name: "rock climbing", technique: "Movement efficiency", proving: "Send a grade-5.11 route" },
  { slug: "bouldering", name: "bouldering", technique: "Body positioning and power", proving: "Send a V5 problem" },
  { slug: "surfing", name: "surfing", technique: "Pop-up and wave reading", proving: "Ride an unbroken wave to shore" },
  { slug: "skateboarding", name: "skateboarding", technique: "Balance and board control", proving: "Land an ollie and a kickflip" },
  { slug: "snowboarding", name: "snowboarding", technique: "Edge control", proving: "Ride a red run confidently" },
  { slug: "skiing", name: "skiing", technique: "Carving technique", proving: "Ski a red run confidently" },
  { slug: "ice-skating", name: "ice skating", technique: "Edges and balance", proving: "Skate forwards and backwards confidently" },
  { slug: "sailing", name: "sailing", technique: "Points of sail and trim", proving: "Skipper a boat unaided" },
  { slug: "kayaking", name: "kayaking", technique: "Paddle stroke and bracing", proving: "Complete a full-day paddle" },
  { slug: "rowing", name: "rowing", technique: "Stroke technique", proving: "Row a 2K time trial" },
  { slug: "horse-riding", name: "horse riding", technique: "Seat and rein control", proving: "Ride confidently at a canter" },
  { slug: "dance-ballroom", name: "ballroom dancing", technique: "Frame and lead-follow", proving: "Dance a full social evening" },
  { slug: "dance-salsa", name: "salsa dancing", technique: "Timing and lead-follow", proving: "Dance socially with strangers" },
  { slug: "dance-hiphop", name: "hip-hop dance", technique: "Groove and isolation", proving: "Perform a full routine" },
  { slug: "dance-ballet", name: "ballet", technique: "Turnout and line", proving: "Perform a full variation" },
  { slug: "gymnastics", name: "gymnastics", technique: "Body tension and shapes", proving: "Perform a clean floor routine" },
  { slug: "parkour", name: "parkour", technique: "Landing and vaulting technique", proving: "Complete a full line safely" },
  { slug: "triathlon", name: "triathlon", technique: "Multi-discipline pacing", proving: "Finish a sprint triathlon" },
  { slug: "ultimate", name: "ultimate frisbee", technique: "Throwing accuracy", proving: "Play a full competitive game", team: true },
  { slug: "padel", name: "padel", technique: "Wall play and positioning", proving: "Win a club-level match" },
  { slug: "bowling", name: "ten-pin bowling", technique: "Release consistency", proving: "Average over 150" },
  { slug: "darts", name: "darts", technique: "Throw consistency", proving: "Check out from 101" },
  { slug: "pool", name: "pool", technique: "Cue action and position play", proving: "Clear the table in one visit" },
  { slug: "weightlifting", name: "Olympic weightlifting", technique: "Snatch and clean technique", proving: "Compete in a local meet" },
];

function learnSport(s: Sport): TemplateSpec {
  return {
    key: `sport-${s.slug}-learn`,
    title: `Learn to play ${s.name}`,
    summary: `Pick up ${s.name} from scratch — the fundamentals, the rules, and enough practice to hold your own.`,
    category: "sport",
    difficulty: 2,
    weeks: 20,
    tags: [s.slug, s.name, "sport", "beginner", ...(s.team ? ["team sport"] : [])],
    skills: ["Rules and basics", s.technique, "Conditioning", ...(s.team ? ["Team play"] : ["Match practice"])],
    milestones: ["Rules and basic technique understood", "Drill the fundamentals consistently", "Play a full session without gassing", s.proving],
  };
}

function competeSport(s: Sport): TemplateSpec {
  return {
    key: `sport-${s.slug}-compete`,
    title: `Compete seriously at ${s.name}`,
    summary: `Move from recreational to competitive ${s.name}, with structured training and real match experience.`,
    category: "competition",
    difficulty: 4,
    weeks: 48,
    tags: [s.slug, s.name, "sport", "competition", "training"],
    skills: [s.technique, "Sport-specific conditioning", "Tactical understanding", "Competition experience", "Recovery and injury prevention", "Video and performance review"],
    milestones: ["Structured training block started", "Technique holding under pressure", "First competitive outing", "Consistent competitive results"],
  };
}

const generated = SPORTS.flatMap((s) => [learnSport(s), competeSport(s)]);

const extras: TemplateSpec[] = [
  {
    key: "sport-coach-qualification",
    title: "Qualify as a sports coach",
    summary: "Get accredited and build the practical skills to coach a team or athlete well.",
    category: "certification",
    difficulty: 3,
    weeks: 28,
    tags: ["coaching", "accreditation", "sport", "teaching"],
    skills: ["Coaching theory", "Session planning", "Athlete communication", "Safeguarding and first aid", "Practical assessment"],
    milestones: ["Course enrolled", "Theory modules complete", "Supervised sessions delivered", "Accreditation awarded"],
  },
  {
    key: "sport-referee",
    title: "Qualify as a referee or umpire",
    summary: "Learn the laws properly and get certified to officiate competitive matches.",
    category: "certification",
    difficulty: 2,
    weeks: 16,
    tags: ["referee", "umpire", "officiating", "rules"],
    skills: ["Laws of the game", "Positioning and signals", "Match control", "Assessment preparation"],
    milestones: ["Laws exam passed", "Officiated a friendly", "Officiated a league match", "Certified and active"],
  },
  {
    key: "sport-comeback",
    title: "Get back into a sport after years away",
    summary: "Rebuild fitness and confidence without the injuries that come from training like you used to.",
    category: "sport",
    difficulty: 2,
    weeks: 16,
    tags: ["comeback", "returning", "fitness", "sport"],
    skills: ["Baseline fitness rebuild", "Technique refresh", "Gradual load progression", "Injury prevention"],
    milestones: ["Baseline assessed", "Training twice a week", "Full session completed comfortably", "Back playing competitively"],
  },
];

export const sport: TemplateDomain = {
  key: "sport",
  label: "Sport",
  blurb: "Learning a sport, training seriously, competing and officiating.",
  templates: [...generated, ...extras],
};
