import { z } from "zod";
import { passwordSchema } from "./password";
import { TASK_TYPES, TASK_STATUSES, PRIORITIES, VISIBILITIES } from "./constants";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email().max(200).transform((s) => s.toLowerCase()),
  password: passwordSchema,
  dailyMinutes: z.coerce.number().int().min(5).max(600).optional(),
  weeklyDays: z.coerce.number().int().min(1).max(7).optional(),
  timezone: z.string().max(64).optional(),
});

export const createGoalSchema = z.object({
  rawInput: z.string().min(3, "Tell me a bit more about the goal").max(2000),
  title: z.string().max(120).optional(),
  targetDate: z.coerce.date().optional().nullable(),
  visibility: z.enum(VISIBILITIES).optional(),
  preferHeuristic: z.boolean().optional(),
  templateKey: z.string().max(80).optional().nullable(),
});

export const decomposeSchema = z.object({
  clarificationAnswers: z.string().max(4000).optional().nullable(),
  preferHeuristic: z.boolean().optional(),
  rawInputOverride: z.string().min(3).max(2000).optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  targetDate: z.coerce.date().nullable().optional(),
  metricCurrent: z.number().nullable().optional(),
});

export const createTaskSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().min(1).max(140),
  description: z.string().max(600).optional(),
  type: z.enum(TASK_TYPES).optional(),
  skillId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(480).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  recurrenceRule: z.string().max(40).nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  description: z.string().max(600).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(480).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  skillId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const completeTaskSchema = z.object({
  minutesSpent: z.coerce.number().int().min(0).max(600).nullable().optional(),
  performance: z.coerce.number().min(0).max(100).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

export const coachMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  goalId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
});

export const coachActionSchema = z.object({
  action: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("create_task"),
      goalId: z.string(),
      title: z.string().max(140),
      description: z.string().max(600).optional(),
      skillName: z.string().max(80).nullable().optional(),
      difficulty: z.coerce.number().int().min(1).max(5).optional(),
      estimatedMinutes: z.coerce.number().int().min(5).max(480).optional(),
      priority: z.enum(PRIORITIES).optional(),
      dueInDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
    }),
    z.object({
      type: z.literal("adjust_timeline"),
      goalId: z.string(),
      newTimelineWeeks: z.coerce.number().int().min(1).max(520),
    }),
    z.object({
      type: z.literal("reprioritise_skill"),
      goalId: z.string(),
      skillName: z.string().max(80),
      newConfidence: z.coerce.number().min(0).max(100),
    }),
  ]),
});

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  return schema.parse(json);
}
