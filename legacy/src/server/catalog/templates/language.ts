import type { TemplateDomain, TemplateSpec } from "../types";

/**
 * Language templates are generated from one shared progression, because the
 * learning path for "become conversational in X" is genuinely the same shape
 * across languages — only the script, resources and difficulty differ.
 */

interface LanguageDef {
  slug: string;
  name: string;
  /** Extra weeks for languages with a new script or greater distance from English. */
  hardness: 0 | 1 | 2;
  exam?: { name: string; level: string };
}

const LANGUAGES: LanguageDef[] = [
  { slug: "spanish", name: "Spanish", hardness: 0, exam: { name: "DELE", level: "B2" } },
  { slug: "french", name: "French", hardness: 0, exam: { name: "DELF", level: "B2" } },
  { slug: "italian", name: "Italian", hardness: 0 },
  { slug: "portuguese", name: "Portuguese", hardness: 0 },
  { slug: "german", name: "German", hardness: 1, exam: { name: "Goethe-Zertifikat", level: "B2" } },
  { slug: "dutch", name: "Dutch", hardness: 0 },
  { slug: "swedish", name: "Swedish", hardness: 0 },
  { slug: "norwegian", name: "Norwegian", hardness: 0 },
  { slug: "danish", name: "Danish", hardness: 1 },
  { slug: "polish", name: "Polish", hardness: 2 },
  { slug: "czech", name: "Czech", hardness: 2 },
  { slug: "romanian", name: "Romanian", hardness: 1 },
  { slug: "greek", name: "Greek", hardness: 2 },
  { slug: "russian", name: "Russian", hardness: 2 },
  { slug: "ukrainian", name: "Ukrainian", hardness: 2 },
  { slug: "turkish", name: "Turkish", hardness: 2 },
  { slug: "arabic", name: "Arabic", hardness: 2 },
  { slug: "hebrew", name: "Hebrew", hardness: 2 },
  { slug: "farsi", name: "Farsi", hardness: 2 },
  { slug: "hindi", name: "Hindi", hardness: 2 },
  { slug: "urdu", name: "Urdu", hardness: 2 },
  { slug: "bengali", name: "Bengali", hardness: 2 },
  { slug: "tamil", name: "Tamil", hardness: 2 },
  { slug: "japanese", name: "Japanese", hardness: 2, exam: { name: "JLPT", level: "N3" } },
  { slug: "korean", name: "Korean", hardness: 2, exam: { name: "TOPIK", level: "3" } },
  { slug: "mandarin", name: "Mandarin Chinese", hardness: 2, exam: { name: "HSK", level: "4" } },
  { slug: "cantonese", name: "Cantonese", hardness: 2 },
  { slug: "vietnamese", name: "Vietnamese", hardness: 2 },
  { slug: "thai", name: "Thai", hardness: 2 },
  { slug: "indonesian", name: "Indonesian", hardness: 0 },
  { slug: "tagalog", name: "Tagalog", hardness: 1 },
  { slug: "swahili", name: "Swahili", hardness: 1 },
  { slug: "finnish", name: "Finnish", hardness: 2 },
  { slug: "hungarian", name: "Hungarian", hardness: 2 },
  { slug: "irish", name: "Irish", hardness: 1 },
  { slug: "welsh", name: "Welsh", hardness: 1 },
];

function conversational(lang: LanguageDef): TemplateSpec {
  const weeks = [36, 48, 64][lang.hardness]!;
  const scriptSkill =
    lang.hardness === 2 ? ["Writing system"] : [];
  return {
    key: `language-${lang.slug}-conversational`,
    title: `Become conversational in ${lang.name}`,
    summary: `Reach the point where you can hold a real ${lang.name} conversation about everyday topics without translating in your head.`,
    category: "language",
    difficulty: lang.hardness === 2 ? 4 : 3,
    weeks,
    tags: [lang.slug, lang.name.toLowerCase(), "language", "conversation", "speaking"],
    skills: [
      ...scriptSkill,
      "Core vocabulary",
      "Grammar foundations",
      "Listening comprehension",
      "Speaking practice",
      "Reading",
    ],
    milestones: [
      "Survival phrases and 300 words",
      "Present and past tenses, 1,000 words",
      "Hold a 5-minute conversation",
      "Follow native content with support",
      `Handle everyday ${lang.name} without translating`,
    ],
    metric: { name: "Vocabulary", target: 2000, unit: "words" },
  };
}

function basics(lang: LanguageDef): TemplateSpec {
  const weeks = [10, 12, 16][lang.hardness]!;
  return {
    key: `language-${lang.slug}-basics`,
    title: `Learn ${lang.name} basics for travel`,
    summary: `Cover the essentials — greetings, directions, food, numbers — so you can get around comfortably in ${lang.name}.`,
    category: "language",
    difficulty: 2,
    weeks,
    tags: [lang.slug, lang.name.toLowerCase(), "language", "travel", "beginner"],
    skills: ["Survival phrases", "Numbers and time", "Pronunciation", "Listening basics"],
    milestones: [
      "Greet and introduce yourself",
      "Order food and ask directions",
      "Handle a simple exchange unaided",
    ],
    metric: { name: "Core phrases", target: 300, unit: "phrases" },
  };
}

function examTemplate(lang: LanguageDef): TemplateSpec | null {
  if (!lang.exam) return null;
  return {
    key: `language-${lang.slug}-exam`,
    title: `Pass ${lang.exam.name} ${lang.exam.level}`,
    summary: `Prepare specifically for the ${lang.exam.name} at level ${lang.exam.level}, covering every assessed skill and the exam format itself.`,
    category: "certification",
    difficulty: 4,
    weeks: 40,
    tags: [lang.slug, lang.name.toLowerCase(), "exam", lang.exam.name.toLowerCase(), "certification"],
    skills: [
      "Exam format familiarity",
      "Reading under time",
      "Listening under time",
      "Written production",
      "Spoken production",
      "Weak-area remediation",
    ],
    milestones: [
      "Diagnostic mock sat, baseline known",
      "All exam sections practised once",
      "Consistent timing across sections",
      "Passing standard on a full mock",
      `Sit ${lang.exam.name} ${lang.exam.level}`,
    ],
  };
}

const generated: TemplateSpec[] = LANGUAGES.flatMap((l) => {
  const out: TemplateSpec[] = [conversational(l), basics(l)];
  const exam = examTemplate(l);
  if (exam) out.push(exam);
  return out;
});

const extras: TemplateSpec[] = [
  {
    key: "language-sign-language",
    title: "Learn sign language to conversational level",
    summary: "Build fluent everyday signing, including fingerspelling, grammar and Deaf cultural context.",
    category: "language",
    difficulty: 3,
    weeks: 40,
    tags: ["sign language", "asl", "bsl", "auslan", "accessibility"],
    skills: ["Fingerspelling", "Core vocabulary", "Spatial grammar", "Receptive comprehension", "Deaf culture"],
    milestones: ["Fingerspell fluently", "200 everyday signs", "Hold a short signed conversation", "Follow signed conversation at natural speed"],
  },
  {
    key: "language-latin-reading",
    title: "Read Latin texts unaided",
    summary: "Work from grammar fundamentals to reading classical prose without a facing translation.",
    category: "language",
    difficulty: 4,
    weeks: 52,
    tags: ["latin", "classics", "reading", "ancient"],
    skills: ["Declensions and conjugations", "Syntax", "Core vocabulary", "Prose reading practice"],
    milestones: ["All five declensions known", "Read adapted prose", "Read unadapted Caesar", "Read Cicero with a dictionary only"],
  },
  {
    key: "language-accent-reduction",
    title: "Soften your accent in a second language",
    summary: "Targeted pronunciation work to be understood more easily and speak with more confidence.",
    category: "language",
    difficulty: 3,
    weeks: 20,
    tags: ["accent", "pronunciation", "phonetics", "speaking"],
    skills: ["Target sound inventory", "Minimal-pair drilling", "Prosody and stress", "Recorded self-review"],
    milestones: ["Problem sounds identified", "Consistent on drilled sounds", "Natural stress and rhythm", "Understood first time in conversation"],
  },
  {
    key: "language-maintain-fluency",
    title: "Stop losing a language you already speak",
    summary: "A light, sustainable maintenance routine that keeps an existing language from fading.",
    category: "habit",
    difficulty: 1,
    weeks: 16,
    tags: ["maintenance", "fluency", "habit", "language"],
    skills: ["Regular input", "Active recall", "Conversation practice"],
    milestones: ["Weekly routine established", "One month sustained", "Comfortable again in conversation"],
  },
  {
    key: "language-interpret-professionally",
    title: "Work as a professional interpreter",
    summary: "Move from bilingual to professionally accredited, with the specialist skills interpreting demands.",
    category: "career",
    difficulty: 5,
    weeks: 72,
    tags: ["interpreting", "translation", "accreditation", "career"],
    skills: ["Consecutive interpreting", "Simultaneous interpreting", "Domain terminology", "Note-taking system", "Ethics and standards", "Accreditation exam prep"],
    milestones: ["Consecutive interpreting of short passages", "Note-taking system fluent", "Simultaneous practice at speed", "Mock accreditation passed", "Accreditation achieved"],
  },
];

export const language: TemplateDomain = {
  key: "language",
  label: "Languages",
  blurb: "Learning to speak, read and be certified in another language.",
  templates: [...generated, ...extras],
};
