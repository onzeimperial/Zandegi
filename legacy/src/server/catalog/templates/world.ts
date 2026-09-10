import type { TemplateDomain, TemplateSpec } from "../types";

interface Topic {
  slug: string;
  name: string;
  /** Why this is hard to learn well rather than superficially. */
  depth: string;
  /** What real understanding lets you do. */
  outcome: string;
  weeks: number;
}

/** Learning a subject out of genuine interest, not for a qualification. */
const TOPICS: Topic[] = [
  { slug: "world-history", name: "world history", depth: "Connecting events across regions rather than memorising dates", outcome: "Explain how the modern world got this way", weeks: 44 },
  { slug: "ancient-rome", name: "ancient Rome", depth: "Separating sources from later myth", outcome: "Explain Rome's rise and collapse properly", weeks: 28 },
  { slug: "ancient-greece", name: "ancient Greece", depth: "Reading primary sources critically", outcome: "Discuss Greek thought and politics with confidence", weeks: 28 },
  { slug: "ancient-egypt", name: "ancient Egypt", depth: "Three thousand years of change, not one static picture", outcome: "Explain Egyptian history across its periods", weeks: 24 },
  { slug: "medieval-history", name: "medieval history", depth: "Getting past the myths about the period", outcome: "Explain medieval society accurately", weeks: 28 },
  { slug: "ww2", name: "the Second World War", depth: "Causes and consequences, not just campaigns", outcome: "Explain the war's origins and aftermath", weeks: 32 },
  { slug: "cold-war", name: "the Cold War", depth: "Multiple perspectives on the same events", outcome: "Explain the whole period coherently", weeks: 28 },
  { slug: "history-of-empire", name: "the history of empires", depth: "Honest engagement with contested history", outcome: "Discuss colonial history with real understanding", weeks: 36 },
  { slug: "history-of-science", name: "the history of science", depth: "Understanding how ideas actually developed", outcome: "Explain how scientific consensus forms", weeks: 28 },
  { slug: "art-history-survey", name: "the history of art", depth: "Seeing works in their context", outcome: "Walk a gallery and understand what you are seeing", weeks: 32 },
  { slug: "architecture", name: "architecture", depth: "Reading buildings for period, function and intent", outcome: "Read any street and understand its buildings", weeks: 28 },
  { slug: "classical-music", name: "classical music", depth: "Active rather than passive listening", outcome: "Follow a symphony and know what to listen for", weeks: 28 },
  { slug: "film-history", name: "film as an art form", depth: "Understanding technique, not just plot", outcome: "Watch analytically and articulate why a film works", weeks: 28 },
  { slug: "philosophy-survey", name: "the history of philosophy", depth: "Following arguments across centuries", outcome: "Explain the major philosophical positions", weeks: 40 },
  { slug: "ethics", name: "ethics", depth: "Holding competing frameworks in mind at once", outcome: "Reason carefully about difficult moral questions", weeks: 28 },
  { slug: "world-religions", name: "the world's religions", depth: "Understanding traditions on their own terms", outcome: "Discuss major traditions accurately and respectfully", weeks: 32 },
  { slug: "mythology", name: "mythology", depth: "Seeing patterns across cultures", outcome: "Recognise mythological references anywhere", weeks: 20 },
  { slug: "astronomy-amateur", name: "astronomy", depth: "Scale, and connecting theory to what you can see", outcome: "Understand and observe the night sky", weeks: 28 },
  { slug: "cosmology", name: "cosmology", depth: "Evidence behind claims about the universe", outcome: "Explain the evidence for the Big Bang and expansion", weeks: 28 },
  { slug: "physics-for-interest", name: "physics for its own sake", depth: "Real understanding rather than analogies", outcome: "Explain relativity and quantum ideas honestly", weeks: 36 },
  { slug: "evolution", name: "evolutionary biology", depth: "Getting past common misconceptions", outcome: "Explain evolution accurately and answer objections", weeks: 24 },
  { slug: "genetics-for-interest", name: "genetics", depth: "Mechanism rather than metaphor", outcome: "Understand genetic news stories properly", weeks: 24 },
  { slug: "human-body", name: "how the human body works", depth: "Integrated systems rather than isolated facts", outcome: "Understand your own health information", weeks: 28 },
  { slug: "nutrition-science", name: "nutrition science", depth: "Evaluating weak studies critically", outcome: "Read nutrition claims and judge them", weeks: 24 },
  { slug: "psychology-for-interest", name: "psychology", depth: "Knowing which findings actually replicated", outcome: "Understand behaviour without pop-psychology myths", weeks: 28 },
  { slug: "economics-for-interest", name: "economics", depth: "Models as tools rather than truth", outcome: "Understand economic news critically", weeks: 28 },
  { slug: "geopolitics", name: "geopolitics", depth: "Multiple national perspectives at once", outcome: "Follow world events with real context", weeks: 32 },
  { slug: "climate-science", name: "climate science", depth: "Understanding the evidence base directly", outcome: "Explain the science and evaluate proposals", weeks: 28 },
  { slug: "ecology-for-interest", name: "ecology and nature", depth: "Systems thinking about living things", outcome: "Read a landscape and understand it", weeks: 24 },
  { slug: "geology-for-interest", name: "geology", depth: "Reading deep time from landscape", outcome: "Understand the landscape you live in", weeks: 24 },
  { slug: "birds", name: "identifying birds", depth: "Sound as much as sight", outcome: "Identify local birds by sight and song", weeks: 28 },
  { slug: "trees-plants", name: "identifying trees and plants", depth: "Year-round identification, not just in leaf", outcome: "Name what grows around you", weeks: 28 },
  { slug: "fungi", name: "fungi and mushrooms", depth: "Certainty in identification matters here", outcome: "Identify common species with confidence", weeks: 32 },
  { slug: "weather", name: "reading the weather", depth: "Connecting sky to forecast to outcome", outcome: "Forecast the next few hours from the sky", weeks: 20 },
  { slug: "mathematics-for-interest", name: "mathematics for pleasure", depth: "Following proofs rather than procedures", outcome: "Read and enjoy a maths book properly", weeks: 36 },
  { slug: "statistics-literacy", name: "statistical literacy", depth: "Spotting misleading presentation", outcome: "Read any statistic critically", weeks: 20 },
  { slug: "ai-literacy", name: "how AI actually works", depth: "Mechanism rather than hype in either direction", outcome: "Discuss AI capabilities and limits accurately", weeks: 24 },
  { slug: "how-things-work", name: "how everyday technology works", depth: "Following systems end to end", outcome: "Explain the technology you use daily", weeks: 24 },
  { slug: "cooking-science", name: "the science of cooking", depth: "Understanding why techniques work", outcome: "Improvise and troubleshoot in the kitchen", weeks: 20 },
  { slug: "media-literacy", name: "media literacy", depth: "Recognising framing and incentives", outcome: "Read news critically without cynicism", weeks: 20 },
  { slug: "law-for-citizens", name: "the law as it affects you", depth: "General principles versus jurisdiction-specific rules", outcome: "Know your rights in common situations", weeks: 20 },
  { slug: "civics", name: "how your government works", depth: "The gap between formal structure and practice", outcome: "Understand and engage with the system properly", weeks: 20 },
];

function learnTopic(t: Topic): TemplateSpec {
  return {
    key: `world-learn-${t.slug}`,
    title: `Properly understand ${t.name}`,
    summary: `Learn ${t.name} in real depth rather than in fragments. The hard part is ${t.depth.toLowerCase()}.`,
    category: "education",
    difficulty: 3,
    weeks: t.weeks,
    tags: [t.slug.replace(/-/g, " "), t.name, "learning", "knowledge", "curiosity"],
    skills: ["Choosing good sources", "Structured reading", "Note-taking and retention", "Testing your understanding", "Connecting ideas"],
    milestones: ["Reading list built", "Foundations covered", "Able to explain it to someone else", t.outcome],
  };
}

const generated = TOPICS.map(learnTopic);

const extras: TemplateSpec[] = [
  {
    key: "world-learn-anything",
    title: "Learn how to learn anything faster",
    summary: "A transferable method for picking up new fields efficiently.",
    category: "education",
    difficulty: 3,
    weeks: 16,
    tags: ["learning", "meta-learning", "study", "skills"],
    skills: ["Scoping a field", "Finding the best sources", "Deliberate practice design", "Feedback loops", "Retention systems"],
    milestones: ["Method understood", "Applied to a small skill", "Applied to a large one", "Method is now default"],
  },
  {
    key: "world-build-knowledge-system",
    title: "Build a personal knowledge system",
    summary: "Notes you actually return to, rather than a graveyard of highlights.",
    category: "education",
    difficulty: 3,
    weeks: 20,
    tags: ["notes", "second brain", "knowledge", "zettelkasten"],
    skills: ["Capture habit", "Processing and linking", "Retrieval", "Periodic review"],
    milestones: ["Capture running", "Notes processed weekly", "Retrieved something genuinely useful", "System sustained for three months"],
  },
  {
    key: "world-follow-news-well",
    title: "Follow the news without it wrecking you",
    summary: "Stay genuinely informed on a sustainable diet rather than a constant drip.",
    category: "habit",
    difficulty: 2,
    weeks: 12,
    tags: ["news", "media", "information", "wellbeing"],
    skills: ["Source selection", "Scheduled consumption", "Depth over frequency", "Noticing emotional manipulation"],
    milestones: ["Sources chosen deliberately", "Fixed schedule adopted", "Better informed and less anxious", "Sustained for two months"],
  },
];

export const world: TemplateDomain = {
  key: "world",
  label: "Understanding the world",
  blurb: "History, science, nature, ideas and learning things purely because they're interesting.",
  templates: [...generated, ...extras],
};
