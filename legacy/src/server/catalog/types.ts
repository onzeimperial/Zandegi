import type { GoalCategory } from "@/lib/constants";

/**
 * Compact authoring format for catalogue entries.
 *
 * Templates are written by hand in src/server/catalog/templates/*.ts, so the
 * shape is deliberately terse — skills and milestones are plain ordered name
 * lists. expand.ts turns a spec into a full GoalPlan (descriptions,
 * prerequisites, level spacing, task backlog) so authors never repeat that
 * boilerplate a thousand times.
 */
export interface TemplateSpec {
  /** Stable kebab-case id, unique across the whole catalogue. */
  key: string;
  title: string;
  /** One or two sentences shown on the catalogue card. */
  summary: string;
  category: GoalCategory;
  /** 1 (light) .. 5 (life-defining). Drives XP, timeline and drop rarity. */
  difficulty: number;
  /** Typical time to completion, in weeks. */
  weeks: number;
  /** Free-text search terms. The title and summary are searched too. */
  tags: string[];
  /** Ordered skill names — the first few get chained as prerequisites. */
  skills: string[];
  /** Ordered milestone titles, spaced evenly across the timeline. */
  milestones: string[];
  /** Optional numeric target, e.g. { name: "Bodyweight", target: 75, unit: "kg" }. */
  metric?: { name: string; target: number; unit?: string };
}

/** One themed file of templates. */
export interface TemplateDomain {
  /** Stable id used for browse grouping and filtering. */
  key: string;
  label: string;
  /** Short line describing what belongs in this domain. */
  blurb: string;
  templates: TemplateSpec[];
}
