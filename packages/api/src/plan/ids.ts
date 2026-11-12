/**
 * Stable chapter and step ids (Story 7.2), and the upcaster that gives them to
 * missions stored before ids existed.
 *
 * The id format is chosen so a claim key is unchanged across the deploy. A
 * generated step's id is its generated position, `"chapter:step"`, so its claim
 * key `${missionId}:step:${id}` is exactly the legacy `${missionId}:step:c:s`. A
 * retry that straddles the deploy therefore races the same claim and pays once.
 *
 * Pure: no store, no clock, no calculator. The same stored mission always
 * upcasts to the same ids.
 */

import type { MissionChapter, MissionDraft, MissionStep } from "../client";

/** The id of the step generated at chapter `c`, step `s`. */
export const positionStepId = (chapterPosition: number, stepPosition: number): string =>
  `${chapterPosition}:${stepPosition}`;

/** The id of the chapter generated at position `c`. */
export const positionChapterId = (chapterPosition: number): string => `${chapterPosition}`;

/** The id of the `n`th step a person added (1-based). Never collides with a position id. */
export const addedStepId = (n: number): string => `own-${n}`;

const GENERATED_STEP_ID = /^\d{1,4}:\d{1,4}$/;

/**
 * True for a step Zandegi generated, whatever its current position or text.
 * Only these pay XP and count toward a chapter or mission bonus.
 */
export const isGeneratedStepId = (stepId: string): boolean => GENERATED_STEP_ID.test(stepId);

/** The shape a stored mission may have: from before ids, or after. */
export type StoredMissionDraft = Omit<MissionDraft, "chapters"> & {
  chapters: (Omit<MissionChapter, "id" | "steps"> & {
    id?: string;
    steps: (Omit<MissionStep, "id"> & { id?: string })[];
  })[];
};

/**
 * Give every chapter and step its id. A mission stored before ids existed gets
 * position ids, which are exactly the ids its ledger events upcast to, so its
 * XP, completed steps and next step are unchanged. A mission that already has
 * ids is returned with them untouched.
 */
export function upcastMission(mission: StoredMissionDraft): MissionDraft {
  return {
    ...mission,
    chapters: mission.chapters.map((chapter, chapterPosition) => ({
      ...chapter,
      id: chapter.id ?? positionChapterId(chapterPosition),
      steps: chapter.steps.map((step, stepPosition) => ({
        ...step,
        id: step.id ?? positionStepId(chapterPosition, stepPosition),
      })),
    })),
  };
}
