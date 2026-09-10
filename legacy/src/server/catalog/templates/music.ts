import type { TemplateDomain, TemplateSpec } from "../types";

interface Instrument {
  slug: string;
  name: string;
  /** Extra difficulty for instruments with a steeper early curve. */
  hard?: boolean;
  /** Skill unique to this instrument, inserted into the progression. */
  signature: string;
}

const INSTRUMENTS: Instrument[] = [
  { slug: "piano", name: "piano", signature: "Hand independence" },
  { slug: "guitar", name: "guitar", signature: "Chord transitions" },
  { slug: "bass", name: "bass guitar", signature: "Groove and timing" },
  { slug: "violin", name: "violin", hard: true, signature: "Intonation" },
  { slug: "cello", name: "cello", hard: true, signature: "Intonation" },
  { slug: "viola", name: "viola", hard: true, signature: "Intonation" },
  { slug: "double-bass", name: "double bass", hard: true, signature: "Intonation" },
  { slug: "drums", name: "drums", signature: "Limb independence" },
  { slug: "ukulele", name: "ukulele", signature: "Chord transitions" },
  { slug: "banjo", name: "banjo", signature: "Roll patterns" },
  { slug: "mandolin", name: "mandolin", signature: "Tremolo picking" },
  { slug: "harp", name: "harp", hard: true, signature: "Pedal and string control" },
  { slug: "flute", name: "flute", signature: "Breath control" },
  { slug: "clarinet", name: "clarinet", signature: "Embouchure" },
  { slug: "saxophone", name: "saxophone", signature: "Embouchure and tone" },
  { slug: "oboe", name: "oboe", hard: true, signature: "Reed and embouchure control" },
  { slug: "bassoon", name: "bassoon", hard: true, signature: "Reed and embouchure control" },
  { slug: "trumpet", name: "trumpet", signature: "Embouchure and range" },
  { slug: "trombone", name: "trombone", signature: "Slide positions" },
  { slug: "french-horn", name: "French horn", hard: true, signature: "Partial accuracy" },
  { slug: "tuba", name: "tuba", signature: "Breath support" },
  { slug: "accordion", name: "accordion", signature: "Bellows control" },
  { slug: "harmonica", name: "harmonica", signature: "Bending notes" },
  { slug: "erhu", name: "erhu", hard: true, signature: "Intonation" },
  { slug: "guzheng", name: "guzheng", signature: "Plucking technique" },
  { slug: "sitar", name: "sitar", hard: true, signature: "Meend and ornamentation" },
  { slug: "koto", name: "koto", signature: "Plucking technique" },
  { slug: "oud", name: "oud", hard: true, signature: "Maqam phrasing" },
  { slug: "bagpipes", name: "bagpipes", hard: true, signature: "Bag and blowing control" },
  { slug: "organ", name: "organ", hard: true, signature: "Pedalboard technique" },
];

function beginner(inst: Instrument): TemplateSpec {
  return {
    key: `music-${inst.slug}-beginner`,
    title: `Learn to play the ${inst.name}`,
    summary: `Start from nothing and get to the point where you can play recognisable pieces on the ${inst.name}.`,
    category: "music",
    difficulty: inst.hard ? 3 : 2,
    weeks: inst.hard ? 24 : 16,
    tags: [inst.slug, inst.name, "music", "instrument", "beginner"],
    skills: ["Posture and setup", inst.signature, "Reading music", "Simple repertoire"],
    milestones: [
      "Comfortable holding and producing a clean sound",
      "Play a simple piece start to finish",
      "Play three pieces from memory",
    ],
  };
}

function intermediate(inst: Instrument): TemplateSpec {
  return {
    key: `music-${inst.slug}-intermediate`,
    title: `Reach intermediate level on ${inst.name}`,
    summary: `Move past beginner pieces into real repertoire on the ${inst.name}, with solid technique and musicality.`,
    category: "music",
    difficulty: inst.hard ? 4 : 3,
    weeks: inst.hard ? 60 : 48,
    tags: [inst.slug, inst.name, "music", "instrument", "intermediate"],
    skills: ["Technical exercises", inst.signature, "Sight-reading", "Music theory", "Repertoire building", "Practice discipline"],
    milestones: [
      "Daily practice routine established",
      "Scales and technique fluent",
      "Perform an intermediate piece cleanly",
      "Build a three-piece performance set",
    ],
  };
}

const generated = INSTRUMENTS.flatMap((i) => [beginner(i), intermediate(i)]);

const extras: TemplateSpec[] = [
  {
    key: "music-learn-to-sing",
    title: "Learn to sing in tune and with control",
    summary: "Build breath support, pitch accuracy and range so singing feels reliable rather than risky.",
    category: "music",
    difficulty: 3,
    weeks: 32,
    tags: ["singing", "voice", "vocal", "pitch"],
    skills: ["Breath support", "Pitch accuracy", "Range extension", "Tone and resonance", "Repertoire"],
    milestones: ["Match pitch reliably", "Sing a song start to finish in tune", "Comfortable across your range", "Perform for someone else"],
  },
  {
    key: "music-theory-fundamentals",
    title: "Understand music theory properly",
    summary: "Go from reading notes to genuinely understanding harmony, keys and structure.",
    category: "music",
    difficulty: 3,
    weeks: 24,
    tags: ["theory", "harmony", "notation", "music"],
    skills: ["Notation and rhythm", "Intervals and scales", "Chords and harmony", "Form and analysis"],
    milestones: ["Read and clap any rhythm", "Build any scale and chord", "Harmonise a melody", "Analyse a full piece"],
  },
  {
    key: "music-perfect-ear",
    title: "Develop a reliable musical ear",
    summary: "Train interval, chord and melodic recognition until you can play what you hear.",
    category: "music",
    difficulty: 4,
    weeks: 36,
    tags: ["ear training", "aural", "intervals", "transcription"],
    skills: ["Interval recognition", "Chord quality recognition", "Melodic dictation", "Transcription practice"],
    milestones: ["All intervals recognised", "Identify chord qualities by ear", "Transcribe a simple melody", "Transcribe a full song by ear"],
  },
  {
    key: "music-produce-track",
    title: "Produce and release a track",
    summary: "Learn a DAW end to end and finish a track good enough to publish.",
    category: "creative",
    difficulty: 3,
    weeks: 24,
    tags: ["production", "daw", "ableton", "logic", "mixing"],
    skills: ["DAW workflow", "Sound design", "Arrangement", "Mixing", "Mastering and release"],
    milestones: ["Finish a 16-bar loop", "Complete a full arrangement", "Mix to a listenable standard", "Release the track"],
  },
  {
    key: "music-write-songs",
    title: "Write your own songs",
    summary: "Develop a repeatable songwriting process and finish a body of original material.",
    category: "creative",
    difficulty: 3,
    weeks: 36,
    tags: ["songwriting", "lyrics", "composition", "creative"],
    skills: ["Melody writing", "Lyric craft", "Chord progressions", "Song structure", "Finishing and editing"],
    milestones: ["Finish one complete song", "Write five songs", "Write ten songs", "Record a demo set"],
    metric: { name: "Finished songs", target: 10, unit: "songs" },
  },
  {
    key: "music-play-live",
    title: "Perform live in front of an audience",
    summary: "Prepare a set and handle the nerves and logistics of playing for real people.",
    category: "music",
    difficulty: 3,
    weeks: 20,
    tags: ["performance", "live", "gig", "stage"],
    skills: ["Set preparation", "Performance under pressure", "Stagecraft", "Gear and logistics"],
    milestones: ["Set list chosen and rehearsed", "Play for one friend", "Play at an open mic", "Play a full booked set"],
  },
  {
    key: "music-join-ensemble",
    title: "Play in a band or ensemble",
    summary: "Develop the listening and timing skills that playing with other people demands.",
    category: "music",
    difficulty: 3,
    weeks: 24,
    tags: ["band", "ensemble", "orchestra", "collaboration"],
    skills: ["Playing to a click", "Listening while playing", "Rehearsal etiquette", "Shared repertoire"],
    milestones: ["Play in time with a click", "First rehearsal completed", "Hold your part in a full run-through", "Perform with the group"],
  },
  {
    key: "music-dj",
    title: "Learn to DJ",
    summary: "Beatmatching, selection and reading a room, up to playing a full set.",
    category: "music",
    difficulty: 2,
    weeks: 20,
    tags: ["dj", "mixing", "decks", "electronic"],
    skills: ["Beatmatching", "Track selection", "Transitions", "Reading the room"],
    milestones: ["Mix two tracks cleanly", "30-minute continuous mix", "Record a full set", "Play to a live audience"],
  },
];

export const music: TemplateDomain = {
  key: "music",
  label: "Music",
  blurb: "Instruments, singing, theory, production and performing.",
  templates: [...generated, ...extras],
};
