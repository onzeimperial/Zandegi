/**
 * Achievement catalogue. Each entry is self-contained: metadata for display
 * plus a pure `check(stats)` returning progress 0..100 (100 => unlocked).
 * `evaluate.ts` builds `stats` and runs every check. Seed mirrors metadata
 * into the DB so it can be queried/joined.
 */

export interface AchievementStats {
  totalXp: number;
  level: number;
  streakCurrent: number;
  streakLongest: number;
  tasksCompleted: number;
  tasksCompletedToday: number;
  goalsActive: number;
  goalsCompleted: number;
  milestonesCompleted: number;
  skillsMastered: number; // mastery >= 80
  distinctGoalCategories: number;
  friends: number;
  challengesWon: number;
  minutesLogged: number;
  perfectWeeks: number; // every planned day hit for a calendar week
  earlyBirdCompletions: number; // tasks completed before 9am
  nightOwlCompletions: number; // tasks completed after 10pm
}

export type AchievementCategory = "consistency" | "mastery" | "milestone" | "social" | "meta";
export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  tier: AchievementTier;
  xpReward: number;
  secret?: boolean;
  /** Progress 0..100 toward unlocking. */
  check: (s: AchievementStats) => number;
}

const ratio = (value: number, target: number) => Math.min(100, Math.round((value / target) * 100));

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "goal_started",
    name: "The First Step",
    description: "Create your first goal",
    icon: "flag",
    category: "milestone",
    tier: "bronze",
    xpReward: 50,
    check: (s) => (s.goalsActive + s.goalsCompleted >= 1 ? 100 : 0),
  },
  {
    key: "first_quest",
    name: "First Quest",
    description: "Complete your first task",
    icon: "check-circle",
    category: "milestone",
    tier: "bronze",
    xpReward: 50,
    check: (s) => (s.tasksCompleted >= 1 ? 100 : 0),
  },
  {
    key: "tasks_25",
    name: "Getting Serious",
    description: "Complete 25 tasks",
    icon: "list-checks",
    category: "consistency",
    tier: "bronze",
    xpReward: 150,
    check: (s) => ratio(s.tasksCompleted, 25),
  },
  {
    key: "tasks_100",
    name: "Centurion",
    description: "Complete 100 tasks",
    icon: "list-checks",
    category: "consistency",
    tier: "silver",
    xpReward: 400,
    check: (s) => ratio(s.tasksCompleted, 100),
  },
  {
    key: "tasks_500",
    name: "Relentless",
    description: "Complete 500 tasks",
    icon: "list-checks",
    category: "consistency",
    tier: "gold",
    xpReward: 1500,
    check: (s) => ratio(s.tasksCompleted, 500),
  },
  {
    key: "streak_3",
    name: "Warming Up",
    description: "Maintain a 3-day streak",
    icon: "flame",
    category: "consistency",
    tier: "bronze",
    xpReward: 75,
    check: (s) => ratio(s.streakLongest, 3),
  },
  {
    key: "streak_7",
    name: "7-Day Streak",
    description: "Maintain a 7-day streak",
    icon: "flame",
    category: "consistency",
    tier: "silver",
    xpReward: 200,
    check: (s) => ratio(s.streakLongest, 7),
  },
  {
    key: "streak_30",
    name: "Consistency Champion",
    description: "Maintain a 30-day streak",
    icon: "flame",
    category: "consistency",
    tier: "gold",
    xpReward: 1000,
    check: (s) => ratio(s.streakLongest, 30),
  },
  {
    key: "streak_100",
    name: "Unbreakable",
    description: "Maintain a 100-day streak",
    icon: "flame",
    category: "consistency",
    tier: "platinum",
    xpReward: 5000,
    check: (s) => ratio(s.streakLongest, 100),
  },
  {
    key: "xp_1000",
    name: "1,000 XP",
    description: "Earn 1,000 total XP",
    icon: "zap",
    category: "meta",
    tier: "bronze",
    xpReward: 100,
    check: (s) => ratio(s.totalXp, 1000),
  },
  {
    key: "xp_10000",
    name: "10,000 XP",
    description: "Earn 10,000 total XP",
    icon: "zap",
    category: "meta",
    tier: "gold",
    xpReward: 1000,
    check: (s) => ratio(s.totalXp, 10000),
  },
  {
    key: "level_10",
    name: "Double Digits",
    description: "Reach account level 10",
    icon: "trending-up",
    category: "meta",
    tier: "silver",
    xpReward: 300,
    check: (s) => ratio(s.level, 10),
  },
  {
    key: "milestone_master",
    name: "Milestone Master",
    description: "Complete 10 milestones",
    icon: "milestone",
    category: "milestone",
    tier: "silver",
    xpReward: 500,
    check: (s) => ratio(s.milestonesCompleted, 10),
  },
  {
    key: "skill_master",
    name: "Skill Master",
    description: "Reach 80%+ mastery on 5 skills",
    icon: "sparkles",
    category: "mastery",
    tier: "gold",
    xpReward: 800,
    check: (s) => ratio(s.skillsMastered, 5),
  },
  {
    key: "goal_completed",
    name: "Finisher",
    description: "Complete a goal end-to-end",
    icon: "trophy",
    category: "milestone",
    tier: "gold",
    xpReward: 1000,
    check: (s) => (s.goalsCompleted >= 1 ? 100 : 0),
  },
  {
    key: "polymath",
    name: "Polymath",
    description: "Have active goals in 4 different categories",
    icon: "layers",
    category: "meta",
    tier: "gold",
    xpReward: 600,
    check: (s) => ratio(s.distinctGoalCategories, 4),
  },
  {
    key: "first_friend",
    name: "Better Together",
    description: "Add your first friend",
    icon: "users",
    category: "social",
    tier: "bronze",
    xpReward: 75,
    check: (s) => (s.friends >= 1 ? 100 : 0),
  },
  {
    key: "challenge_win",
    name: "Champion",
    description: "Win a challenge",
    icon: "swords",
    category: "social",
    tier: "silver",
    xpReward: 400,
    check: (s) => (s.challengesWon >= 1 ? 100 : 0),
  },
  {
    key: "early_bird",
    name: "Early Bird",
    description: "Complete 10 tasks before 9am",
    icon: "sunrise",
    category: "consistency",
    tier: "silver",
    xpReward: 250,
    secret: true,
    check: (s) => ratio(s.earlyBirdCompletions, 10),
  },
  {
    key: "night_owl",
    name: "Night Owl",
    description: "Complete 10 tasks after 10pm",
    icon: "moon",
    category: "consistency",
    tier: "silver",
    xpReward: 250,
    secret: true,
    check: (s) => ratio(s.nightOwlCompletions, 10),
  },
  {
    key: "deep_work",
    name: "Deep Work",
    description: "Log 50 hours of focused effort",
    icon: "timer",
    category: "mastery",
    tier: "gold",
    xpReward: 900,
    check: (s) => ratio(s.minutesLogged, 3000),
  },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));
