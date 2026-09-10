import { z } from "zod";
import { GOAL_CATEGORIES, TASK_TYPES, PRIORITIES } from "@/lib/constants";

/**
 * Schemas for every piece of structured data we accept from the model.
 * Model output is ALWAYS validated against these before it touches the DB.
 */

export const clarificationSchema = z.object({
  needsClarification: z.literal(true),
  questions: z.array(z.string().min(3)).min(1).max(4),
  interpretationSoFar: z.string().min(1),
});

export const planSkillSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional().default(""),
  category: z.string().max(60).optional().default(""),
  parent: z.string().max(80).nullable().optional().default(null),
  startingConfidence: z.number().min(0).max(100).optional().default(40),
  prerequisites: z.array(z.string().max(80)).max(8).optional().default([]),
});

export const planTaskSchema = z.object({
  title: z.string().min(1).max(140),
  description: z.string().max(600).optional().default(""),
  type: z.enum(TASK_TYPES).optional().default("once"),
  skill: z.string().max(80).nullable().optional().default(null),
  milestone: z.string().max(120).nullable().optional().default(null),
  difficulty: z.number().int().min(1).max(5).optional().default(2),
  estimatedMinutes: z.number().int().min(5).max(480).optional().default(30),
  priority: z.enum(PRIORITIES).optional().default("medium"),
  recurrence: z.string().max(40).nullable().optional().default(null),
});

export const planMilestoneSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional().default(""),
  targetLevel: z.number().int().min(0).max(200).optional().default(0),
  etaWeeks: z.number().min(0).max(520).optional().default(0),
});

export const planResourceSchema = z.object({
  title: z.string().min(1).max(160),
  url: z.string().url().nullable().optional().default(null),
  type: z.enum(["video", "book", "course", "article", "tool", "practice", "community"]).optional().default("article"),
  skill: z.string().max(80).nullable().optional().default(null),
  note: z.string().max(300).optional().default(""),
});

export const goalPlanSchema = z.object({
  needsClarification: z.literal(false).optional().default(false),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
  category: z.enum(GOAL_CATEGORIES),
  difficulty: z.number().int().min(1).max(5),
  confidence: z.number().int().min(0).max(100),
  startLevel: z.number().int().min(1).max(50).default(1),
  targetLevel: z.number().int().min(2).max(200).default(10),
  recommendedTimelineWeeks: z.number().int().min(1).max(520),
  metric: z
    .object({
      name: z.string().max(60),
      start: z.number(),
      target: z.number(),
      unit: z.string().max(24).optional().default(""),
    })
    .nullable()
    .optional()
    .default(null),
  milestones: z.array(planMilestoneSchema).min(1).max(12),
  skills: z.array(planSkillSchema).min(1).max(30),
  tasks: z.array(planTaskSchema).min(3).max(40),
  resources: z.array(planResourceSchema).max(20).optional().default([]),
  habits: z.array(z.string().max(160)).max(10).optional().default([]),
  risks: z.array(z.string().max(200)).max(8).optional().default([]),
  uncertainFacts: z.array(z.string().max(240)).max(10).optional().default([]),
});

export type GoalPlan = z.infer<typeof goalPlanSchema>;
export type Clarification = z.infer<typeof clarificationSchema>;

/** Either a plan, or a request for clarification. */
export const decompositionResultSchema = z.union([clarificationSchema, goalPlanSchema]);
export type DecompositionResult = z.infer<typeof decompositionResultSchema>;

// ── Coach structured actions ───────────────────────────────

export const coachActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    goalIdRef: z.string(),
    title: z.string().max(140),
    description: z.string().max(600).optional().default(""),
    skillName: z.string().max(80).nullable().optional().default(null),
    difficulty: z.number().int().min(1).max(5).optional().default(2),
    estimatedMinutes: z.number().int().min(5).max(480).optional().default(30),
    priority: z.enum(PRIORITIES).optional().default("medium"),
    dueInDays: z.number().int().min(0).max(365).nullable().optional().default(null),
  }),
  z.object({
    type: z.literal("adjust_timeline"),
    goalIdRef: z.string(),
    newTimelineWeeks: z.number().int().min(1).max(520),
    reason: z.string().max(400),
  }),
  z.object({
    type: z.literal("reprioritise_skill"),
    goalIdRef: z.string(),
    skillName: z.string().max(80),
    newConfidence: z.number().min(0).max(100),
    reason: z.string().max(400),
  }),
]);

export const coachReplySchema = z.object({
  reply: z.string().min(1).max(4000),
  focusToday: z.array(z.string().max(200)).max(5).optional().default([]),
  recommendations: z
    .array(
      z.object({
        kind: z.enum(["focus", "revise", "plan_change", "resource", "pace", "wellbeing"]),
        title: z.string().max(120),
        body: z.string().max(600),
        priority: z.number().int().min(1).max(5).optional().default(3),
      }),
    )
    .max(5)
    .optional()
    .default([]),
  proposedActions: z.array(coachActionSchema).max(6).optional().default([]),
  confidence: z.number().int().min(0).max(100).optional().default(70),
});

export type CoachReply = z.infer<typeof coachReplySchema>;
export type CoachAction = z.infer<typeof coachActionSchema>;
