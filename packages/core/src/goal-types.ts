/**
 * Goal types and what each is allowed to display (SPEC §1.3).
 *
 * Product law 2 (CLAUDE.md §2): no fake precision. OUTCOME goals never show a
 * percentage. This table is the enforcement point — `assertProgressDisplay`
 * is called wherever a progress UI is chosen.
 */

export const GOAL_TYPES = ["OUTCOME", "METRIC", "HABIT", "PROJECT", "EXPERIENCE"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const EFFORT_BANDS = ["SPRINT", "SEASON", "CAMPAIGN", "LIFEWORK"] as const;
export type EffortBand = (typeof EFFORT_BANDS)[number];

/** How a goal's progress may be rendered. */
export type ProgressDisplay =
  | "CHAPTERS" // chapters complete + evidence count + next action
  | "METRIC_BAR" // current -> target with a trend line
  | "CONSISTENCY" // streak / consistency % / calendar heatmap
  | "SCOPE" // steps complete of a finite defined scope
  | "CHECKLIST"; // readiness checklist, booked / not

const ALLOWED: Record<GoalType, ProgressDisplay[]> = {
  OUTCOME: ["CHAPTERS"],
  METRIC: ["METRIC_BAR", "CHAPTERS"],
  HABIT: ["CONSISTENCY", "CHAPTERS"],
  PROJECT: ["SCOPE", "METRIC_BAR", "CHAPTERS"],
  EXPERIENCE: ["CHECKLIST", "CHAPTERS"],
};

export function progressDisplayAllowed(goalType: GoalType, display: ProgressDisplay): boolean {
  return ALLOWED[goalType].includes(display);
}

export function assertProgressDisplay(goalType: GoalType, display: ProgressDisplay): void {
  if (!progressDisplayAllowed(goalType, display)) {
    throw new Error(
      `progress display "${display}" is not permitted for a ${goalType} goal ` +
        `(allowed: ${ALLOWED[goalType].join(", ")}). See SPEC §1.3.`,
    );
  }
}

/** True when a numeric percentage may ever be shown for this goal type. */
export function percentageAllowed(goalType: GoalType): boolean {
  // Only METRIC (real quantity) and PROJECT (finite scope) have an honest
  // denominator. Everything else would be inventing one.
  return goalType === "METRIC" || goalType === "PROJECT";
}
