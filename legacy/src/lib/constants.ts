/**
 * Centralised string-"enum" values. The DB stores plain strings so the schema
 * runs on both SQLite and Postgres; these arrays are the source of truth and
 * are reused by Zod validators throughout the app.
 */

export const GOAL_CATEGORIES = [
  "education",
  "exam",
  "career",
  "programming",
  "language",
  "music",
  "sport",
  "fitness",
  "business",
  "finance",
  "creative",
  "research",
  "personal_development",
  "project",
  "habit",
  "certification",
  "competition",
  "general",
] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const VISIBILITIES = ["private", "friends", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const DECOMPOSITION_STATUSES = [
  "pending",
  "generating",
  "ready",
  "failed",
  "manual",
] as const;

export const MILESTONE_STATUSES = ["locked", "active", "done"] as const;

export const TASK_TYPES = ["once", "daily", "weekly", "project", "milestone"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done", "skipped"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const XP_SOURCES = [
  "task_complete",
  "milestone",
  "streak",
  "achievement",
  "assessment",
  "manual",
] as const;

export const COIN_SOURCES = [
  "task_complete",
  "milestone",
  "goal_complete",
  "achievement",
  "streak",
  "level_up",
  "purchase",
  "refund",
  "grant",
] as const;
export type CoinSource = (typeof COIN_SOURCES)[number];

/** Cosmetic slots, ordered back-to-front for SVG layering. */
export const COSMETIC_SLOTS = [
  "aura",
  "base",
  "outfit",
  "face",
  "hair",
  "accessory",
  "frame",
] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

/** Rarity tiers, ascending. Index doubles as the tier's numeric rank. */
export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
] as const;
export type Rarity = (typeof RARITIES)[number];

export const COSMETIC_SOURCES = [
  "default",
  "purchase",
  "drop",
  "achievement",
  "grant",
] as const;
export type CosmeticSource = (typeof COSMETIC_SOURCES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

/** Display colour per rarity — used for borders, glows and text. */
export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  mythic: "#ec4899",
};

export const COSMETIC_SLOT_LABELS: Record<CosmeticSlot, string> = {
  aura: "Aura",
  base: "Body",
  outfit: "Outfit",
  face: "Face",
  hair: "Hair",
  accessory: "Accessory",
  frame: "Frame",
};

// ── Subscription ────────────────────────────────────────────

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  "none",
  "trialing",
  "active",
  "cancelled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Length of the no-card free trial. */
export const TRIAL_DAYS = 14;

// ── Leagues ─────────────────────────────────────────────────

/** Ascending. Top finishers promote, bottom finishers relegate. */
export const DIVISIONS = [
  "bronze",
  "silver",
  "gold",
  "sapphire",
  "ruby",
  "diamond",
] as const;
export type Division = (typeof DIVISIONS)[number];

export const DIVISION_LABELS: Record<Division, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  sapphire: "Sapphire",
  ruby: "Ruby",
  diamond: "Diamond",
};

export const DIVISION_COLORS: Record<Division, string> = {
  bronze: "#b45309",
  silver: "#94a3b8",
  gold: "#f59e0b",
  sapphire: "#3b82f6",
  ruby: "#e11d48",
  diamond: "#22d3ee",
};

export const LEAGUE_OUTCOMES = ["promoted", "held", "relegated"] as const;
export type LeagueOutcome = (typeof LEAGUE_OUTCOMES)[number];

/** The moments worth writing to the Crew activity feed — see ActivityEvent. */
export const ACTIVITY_KINDS = [
  "milestone_complete",
  "goal_complete",
  "level_up",
  "achievement_unlock",
  "cosmetic_drop",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const RECO_KINDS = [
  "focus",
  "revise",
  "plan_change",
  "resource",
  "pace",
  "wellbeing",
] as const;

export const NOTIFICATION_TYPES = [
  "deadline",
  "missed_task",
  "daily_plan",
  "achievement",
  "challenge",
  "milestone",
  "ai_reco",
  "friend",
] as const;

export const FRIENDSHIP_STATUSES = ["pending", "accepted", "blocked"] as const;

export const CHALLENGE_METRICS = ["xp", "tasks", "minutes", "streak"] as const;

/** Human-readable labels for categories (UI). */
export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  education: "Education",
  exam: "Exam prep",
  career: "Career",
  programming: "Programming",
  language: "Language",
  music: "Music",
  sport: "Sport",
  fitness: "Fitness",
  business: "Business",
  finance: "Finance",
  creative: "Creative",
  research: "Research",
  personal_development: "Personal development",
  project: "Project",
  habit: "Habit",
  certification: "Certification",
  competition: "Competition",
  general: "General",
};
