import type { GoalType } from "@zandegi/core";

export interface DemoMission {
  title: string;
  goalType: GoalType;
  summary: string;
  next: string;
}

export const demoMissions: readonly DemoMission[] = [
  {
    title: "Bench 100 kg",
    goalType: "METRIC",
    summary: "72.5 of 100 kg · Chapter 2 of 5",
    next: "Push day A · 5×5 at 75 kg",
  },
  {
    title: "Learn Farsi",
    goalType: "OUTCOME",
    summary: "1 of 6 chapters · 3 pieces of evidence",
    next: "20-minute tutor trial",
  },
] as const;

export const demoDomains = [
  ["Mind", 11], ["Edge", 9], ["Coin", 6], ["Body", 8],
  ["Grit", 12], ["Craft", 7], ["Bond", 5], ["World", 4],
] as const;

export const demoLeague = [
  { rank: 1, initials: "M", name: "Maya R.", xp: "1,940" },
  { rank: 2, initials: "T", name: "Tom K.", xp: "1,715" },
  { rank: 3, initials: "P", name: "Priya S.", xp: "1,602" },
  { rank: 4, initials: "Y", name: "You", xp: "1,480" },
] as const;

export const shopItems = [
  { name: "Aurora frame", price: 120, kind: "Frame", swatch: "aurora" },
  { name: "Midnight theme", price: 200, kind: "Theme", swatch: "midnight" },
  { name: "Crown badge", price: 90, kind: "Badge", swatch: "crown" },
  { name: "Ember streak flame", price: 150, kind: "Effect", swatch: "ember" },
] as const;

export const manualChapters = [
  { title: "Know the pathway", goal: "Shortlist 5 universities and their entry rules" },
  { title: "Prepare for UCAT", goal: "Complete a full practice test under exam timing" },
  { title: "Get real-world experience", goal: "Log 20 hours volunteering or shadowing" },
  { title: "Become interview ready", goal: "Complete three mock interviews with feedback" },
] as const;
