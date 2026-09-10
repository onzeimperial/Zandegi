import type { TemplateDomain, TemplateSpec } from "../types";

interface Hobby {
  slug: string;
  name: string;
  /** The core skill that improvement actually depends on. */
  core: string;
  /** A concrete achievement that shows real competence. */
  proving: string;
  difficulty: number;
  weeks: number;
  category?: "creative" | "education" | "competition" | "general";
}

const HOBBIES: Hobby[] = [
  { slug: "chess", name: "chess", core: "Tactical pattern recognition", proving: "Reach a 1500 rating", difficulty: 4, weeks: 40, category: "competition" },
  { slug: "go", name: "Go", core: "Shape and life-and-death reading", proving: "Reach a solid single-digit kyu", difficulty: 5, weeks: 60, category: "competition" },
  { slug: "poker", name: "poker", core: "Ranges and pot odds", proving: "Beat a level consistently over volume", difficulty: 4, weeks: 44, category: "competition" },
  { slug: "bridge", name: "bridge", core: "Bidding systems and partnership", proving: "Play competently in a club", difficulty: 4, weeks: 40, category: "competition" },
  { slug: "backgammon", name: "backgammon", core: "Checker play and cube decisions", proving: "Beat intermediate opposition", difficulty: 3, weeks: 28, category: "competition" },
  { slug: "rubiks-cube", name: "solving a Rubik's cube", core: "Algorithm memorisation and finger tricks", proving: "Solve consistently under a minute", difficulty: 2, weeks: 12 },
  { slug: "speedcubing", name: "speedcubing", core: "Look-ahead and algorithm fluency", proving: "Average under 20 seconds", difficulty: 4, weeks: 40, category: "competition" },
  { slug: "juggling", name: "juggling", core: "Throw consistency", proving: "Juggle four balls or three-ball tricks", difficulty: 2, weeks: 16 },
  { slug: "magic", name: "close-up magic", core: "Sleight of hand and misdirection", proving: "Perform a full routine for strangers", difficulty: 3, weeks: 32, category: "creative" },
  { slug: "cardistry", name: "cardistry", core: "Finger dexterity and flow", proving: "Perform a smooth multi-move flourish", difficulty: 3, weeks: 24, category: "creative" },
  { slug: "origami", name: "origami", core: "Precision folding", proving: "Fold a complex model unaided", difficulty: 2, weeks: 16, category: "creative" },
  { slug: "memory-techniques", name: "memory techniques", core: "Memory palace construction", proving: "Memorise a shuffled deck of cards", difficulty: 4, weeks: 28, category: "education" },
  { slug: "mental-maths", name: "mental arithmetic", core: "Calculation shortcuts", proving: "Multiply large numbers mentally", difficulty: 3, weeks: 20, category: "education" },
  { slug: "crosswords", name: "cryptic crosswords", core: "Recognising clue types", proving: "Finish a broadsheet cryptic unaided", difficulty: 3, weeks: 28, category: "education" },
  { slug: "sudoku", name: "advanced sudoku", core: "Advanced solving techniques", proving: "Solve expert puzzles without guessing", difficulty: 2, weeks: 14, category: "education" },
  { slug: "board-games", name: "modern board games", core: "Strategic depth and teaching others", proving: "Teach and run a game night", difficulty: 1, weeks: 12 },
  { slug: "dungeons-dragons", name: "running tabletop RPGs", core: "Improvisation and pacing", proving: "Run a full campaign arc", difficulty: 3, weeks: 36, category: "creative" },
  { slug: "warhammer", name: "miniature wargaming", core: "Painting and list building", proving: "Field a fully painted army", difficulty: 3, weeks: 40, category: "creative" },
  { slug: "miniature-painting", name: "miniature painting", core: "Thin layers and contrast", proving: "Paint a display-standard model", difficulty: 3, weeks: 28, category: "creative" },
  { slug: "chess-openings", name: "a chess opening repertoire", core: "Understanding plans, not just moves", proving: "Play your repertoire confidently in games", difficulty: 3, weeks: 24, category: "competition" },
  { slug: "esports", name: "competitive gaming", core: "Mechanics and game sense", proving: "Reach a high competitive rank", difficulty: 4, weeks: 44, category: "competition" },
  { slug: "speedrunning", name: "speedrunning", core: "Route optimisation and consistency", proving: "Post a competitive personal best", difficulty: 4, weeks: 36, category: "competition" },
  { slug: "collecting", name: "building a serious collection", core: "Knowledge and authentication", proving: "A curated, well-documented collection", difficulty: 2, weeks: 40 },
  { slug: "genealogy", name: "researching your family history", core: "Source verification", proving: "Trace a line back five generations", difficulty: 3, weeks: 36, category: "education" },
  { slug: "amateur-radio", name: "amateur radio", core: "Regulations and propagation", proving: "Get licensed and make contacts", difficulty: 3, weeks: 24, category: "education" },
  { slug: "astrophotography", name: "astrophotography", core: "Tracking and stacking", proving: "Capture a deep-sky object", difficulty: 4, weeks: 36, category: "creative" },
  { slug: "beekeeping", name: "beekeeping", core: "Colony health assessment", proving: "Bring a hive through a full year", difficulty: 3, weeks: 52 },
  { slug: "aquascaping", name: "aquascaping", core: "Water chemistry and balance", proving: "A stable, planted tank after six months", difficulty: 3, weeks: 32, category: "creative" },
  { slug: "bonsai", name: "bonsai", core: "Patience and structural pruning", proving: "A tree in training for two years", difficulty: 4, weeks: 104, category: "creative" },
  { slug: "gardening-flowers", name: "growing flowers", core: "Seasonal planning", proving: "Continuous colour through a season", difficulty: 2, weeks: 32 },
  { slug: "kite-flying", name: "stunt kite flying", core: "Line control", proving: "Fly a full trick sequence", difficulty: 2, weeks: 14 },
  { slug: "skipping", name: "skipping rope skills", core: "Timing and rhythm", proving: "Chain double-unders and crossovers", difficulty: 2, weeks: 14 },
  { slug: "yoyo", name: "yo-yo tricks", core: "String control", proving: "Perform an advanced trick chain", difficulty: 2, weeks: 16 },
  { slug: "whittling", name: "whittling", core: "Knife control and grain reading", proving: "Carve a detailed figure", difficulty: 2, weeks: 16, category: "creative" },
  { slug: "geocaching", name: "geocaching", core: "Navigation and search technique", proving: "Find 100 caches including difficult ones", difficulty: 1, weeks: 24 },
  { slug: "metal-detecting", name: "metal detecting", core: "Signal interpretation and permissions", proving: "Make a properly recorded find", difficulty: 2, weeks: 24 },
  { slug: "cosplay", name: "cosplay", core: "Pattern making and finishing", proving: "A complete costume worn at an event", difficulty: 3, weeks: 32, category: "creative" },
  { slug: "voice-acting", name: "voice acting", core: "Character voice and delivery", proving: "A demo reel and first booked work", difficulty: 3, weeks: 36, category: "creative" },
  { slug: "improv", name: "improv comedy", core: "Listening and yes-and", proving: "Perform in a live improv show", difficulty: 3, weeks: 28, category: "creative" },
  { slug: "stand-up", name: "stand-up comedy", core: "Writing and timing", proving: "Perform a tight five at an open mic", difficulty: 4, weeks: 36, category: "creative" },
  { slug: "acting", name: "acting", core: "Truthful behaviour under imaginary circumstances", proving: "Perform a role in a production", difficulty: 4, weeks: 40, category: "creative" },
  { slug: "debating", name: "debating", core: "Argument construction and rebuttal", proving: "Win a competitive debate", difficulty: 3, weeks: 28, category: "competition" },
  { slug: "public-quizzing", name: "pub quizzing", core: "Broad recall and team play", proving: "Win a quiz league night", difficulty: 2, weeks: 24, category: "competition" },
];

function learnHobby(h: Hobby): TemplateSpec {
  return {
    key: `hobbies-${h.slug}`,
    title: `Get good at ${h.name}`,
    summary: `Move from dabbling to genuinely competent at ${h.name}. Progress hinges on ${h.core.toLowerCase()}.`,
    category: h.category ?? "general",
    difficulty: h.difficulty,
    weeks: h.weeks,
    tags: [h.slug.replace(/-/g, " "), h.name, "hobby", "skill", "practice"],
    skills: ["Fundamentals", h.core, "Deliberate practice", "Learning from stronger players or makers", "Consistency"],
    milestones: ["Basics understood", "Regular practice established", "Noticeably better than when you started", h.proving],
  };
}

const generated = HOBBIES.map(learnHobby);

const extras: TemplateSpec[] = [
  {
    key: "hobbies-read-more",
    title: "Read more books",
    summary: "Build a reading habit that survives a phone in your pocket.",
    category: "habit",
    difficulty: 2,
    weeks: 52,
    tags: ["reading", "books", "habit", "literature"],
    skills: ["Protected reading time", "Book selection", "Abandoning bad books", "Note-taking and retention"],
    milestones: ["Daily reading slot established", "Ten books read", "Twenty-five books read", "Reading is automatic"],
    metric: { name: "Books read", target: 40, unit: "books" },
  },
  {
    key: "hobbies-read-classics",
    title: "Read the classics you keep meaning to",
    summary: "Work through genuinely difficult books with structure and support.",
    category: "education",
    difficulty: 3,
    weeks: 52,
    tags: ["classics", "literature", "reading", "canon"],
    skills: ["Choosing editions and translations", "Reading difficult prose", "Using companions and criticism", "Sustained attention"],
    milestones: ["List chosen", "First classic finished", "Five finished", "Ten finished"],
  },
  {
    key: "hobbies-find-a-hobby",
    title: "Find a hobby you actually stick with",
    summary: "Systematically try things rather than waiting to stumble into an interest.",
    category: "personal_development",
    difficulty: 1,
    weeks: 20,
    tags: ["hobby", "interests", "exploration", "trying"],
    skills: ["Structured sampling", "Honest evaluation", "Lowering the barrier to starting", "Committing once you find one"],
    milestones: ["Shortlist of five made", "Three genuinely tried", "One chosen", "Two months sustained"],
  },
  {
    key: "hobbies-join-a-club",
    title: "Join a club and actually keep going",
    summary: "The social accountability that makes a hobby stick, and the awkward first weeks.",
    category: "personal_development",
    difficulty: 2,
    weeks: 16,
    tags: ["club", "community", "social", "hobby"],
    skills: ["Finding local groups", "Getting through the first sessions", "Building familiarity", "Contributing"],
    milestones: ["Club found", "First session attended", "Attended for a month", "Genuinely part of the group"],
  },
  {
    key: "hobbies-teach-your-skill",
    title: "Teach your hobby to someone else",
    summary: "Teaching exposes the gaps in your own understanding faster than anything else.",
    category: "personal_development",
    difficulty: 3,
    weeks: 20,
    tags: ["teaching", "mentoring", "skill", "sharing"],
    skills: ["Breaking a skill into steps", "Explaining without jargon", "Giving useful feedback", "Adapting to the learner"],
    milestones: ["Curriculum sketched", "First lesson taught", "A learner reached a milestone", "Teaching regularly"],
  },
];

export const hobbies: TemplateDomain = {
  key: "hobbies",
  label: "Hobbies & games",
  blurb: "Games, puzzles, performance, collecting and skills worth having for their own sake.",
  templates: [...generated, ...extras],
};
