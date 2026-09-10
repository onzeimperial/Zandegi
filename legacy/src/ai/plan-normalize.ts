import { goalPlanSchema, type GoalPlan } from "./schemas";
import { GOAL_CATEGORY_LABELS, type GoalCategory } from "@/lib/constants";

/**
 * Repair cross-references the model may have gotten slightly wrong so a plan is
 * safe to persist: drop skill parents / task links that point at nothing, dedupe,
 * clamp. Pure — no IO. Unit tested.
 */
export function normalisePlan(plan: GoalPlan): GoalPlan {
  const skillNames = new Set(plan.skills.map((s) => s.name));
  const milestoneTitles = new Set(plan.milestones.map((m) => m.title));

  const skills = plan.skills.map((s) => ({
    ...s,
    parent: s.parent && skillNames.has(s.parent) && s.parent !== s.name ? s.parent : null,
    prerequisites: (s.prerequisites ?? []).filter((p) => skillNames.has(p) && p !== s.name),
  }));

  const tasks = plan.tasks.map((t) => ({
    ...t,
    skill: t.skill && skillNames.has(t.skill) ? t.skill : null,
    milestone: t.milestone && milestoneTitles.has(t.milestone) ? t.milestone : null,
  }));

  const targetLevel = Math.max(plan.startLevel + 1, plan.targetLevel);

  return goalPlanSchema.parse({ ...plan, skills, tasks, targetLevel });
}

export function categoryLabel(cat: string): string {
  return GOAL_CATEGORY_LABELS[cat as GoalCategory] ?? "General";
}
