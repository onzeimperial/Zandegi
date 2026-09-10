import type { Domain } from "@/server/domains";

export type NodeState = "done" | "active" | "available" | "locked";

export interface PathNode {
  id: string;
  title: string;
  xpReward: number;
  state: NodeState;
}

export interface PathChapter {
  id: string;
  title: string;
  description: string | null;
  status: "locked" | "active" | "done";
  targetLevel: number;
  xpReward: number;
  tasksDone: number;
  tasksTotal: number;
  nodes: PathNode[];
}

export interface MissionSummary {
  goalId: string;
  title: string;
  domain: Domain | null;
  color: string;
  progressPct: number;
  level: number;
  isSelected: boolean;
}

export interface MissionPath {
  goalId: string;
  title: string;
  domain: Domain | null;
  color: string;
  progressPct: number;
  level: number;
  targetLevel: number;
  chapters: PathChapter[];
  /** The single active node across the whole mission, if any remain. */
  activeNodeId: string | null;
}

export type ChangeEvent =
  | { kind: "milestone_completed"; title: string; goalTitle: string; xpReward: number }
  | { kind: "level_up"; level: number }
  | { kind: "streak_advanced"; current: number };
