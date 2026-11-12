/**
 * Editing a mission's plan (Story 8.1): fit it to a life.
 *
 * What a person may change: a step's title or guide text, the order of steps
 * within a chapter, adding a step, deleting a step, and a chapter's title. What
 * they may not: adding or removing a chapter, or a chapter's exit condition
 * (spec B owns that). Those are refused as `INVALID_REQUEST`, as is deleting a
 * chapter's last step, which would remove the chapter in all but name.
 *
 * Three rules hold whatever the edit:
 *   - Ownership: the mission is read through `readMission`, so another person's
 *     mission is `MISSION_NOT_FOUND`, exactly like one that does not exist.
 *   - Versions: an edit names the version it was made against, and the save is
 *     a compare-and-set on it. A stale edit saves nothing (`PLAN_EDIT_CONFLICT`).
 *   - The ledger is untouched. No edit writes, rewrites or removes an event
 *     (laws 3 and 4), so XP already paid never changes. This module has no
 *     ledger port to make that possible.
 *
 * An edited or added step is the person's own words: it carries no sources, is
 * marked `writtenBy: "person"`, and there is no model or grounding port here to
 * send it to (approved 2026-11-03).
 */

import {
  PLAN_EDIT_LIMITS,
  PLAN_EDIT_OPS,
  type MissionChapter,
  type MissionDraft,
  type MissionStep,
  type PlanEdit,
  type PlanEditRequest,
  type StoredMissionView,
} from "../client";
import { detectFactualClaims } from "@zandegi/ai";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import type { GenerationPersistencePort, MissionPlanStorePort } from "../ports";
import { addedStepId } from "./ids";
import { storeCall } from "./store-call";

export interface EditPlanInput {
  /** The resolved owner. Editing never mints one. */
  principal: GuestPrincipal;
  /** Untrusted: from the URL. */
  missionId: unknown;
  /** Untrusted: the parsed JSON body. */
  request: unknown;
}

export interface EditPlanPorts {
  persistence: GenerationPersistencePort;
  plans: MissionPlanStorePort;
}

function invalid(diagnostic: string): never {
  throw new GenerationError("INVALID_REQUEST", diagnostic);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;

function id(value: unknown, field: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) invalid(`${field} is not an id`);
  return value;
}

/** One line of text: trimmed, not empty, no line breaks, within `max`. */
function title(value: unknown, field: string): string {
  if (typeof value !== "string") invalid(`${field} is not text`);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > PLAN_EDIT_LIMITS.maxTitleLength) {
    invalid(`${field} length out of range`);
  }
  if (/[\r\n]/.test(trimmed)) invalid(`${field} spans lines`);
  return trimmed;
}

/** Guide text: may span lines, may be empty, within the limit. */
function approach(value: unknown): string {
  if (typeof value !== "string") invalid("approach is not text");
  const trimmed = value.trim();
  if (trimmed.length > PLAN_EDIT_LIMITS.maxApproachLength) invalid("approach too long");
  return trimmed;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], what: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid(`${what} has an unknown field`);
  }
}

function parseEdit(value: unknown): PlanEdit {
  if (!isRecord(value)) invalid("edit is not an object");
  const { op } = value;
  if (typeof op !== "string" || !(PLAN_EDIT_OPS as readonly string[]).includes(op)) {
    // Includes every chapter add or remove: there is no such operation.
    invalid("unknown edit operation");
  }
  switch (op as PlanEdit["op"]) {
    case "renameChapter":
      // No `exitCondition` key: a chapter's exit condition belongs to spec B.
      onlyKeys(value, ["op", "chapterId", "title"], "renameChapter");
      return {
        op: "renameChapter",
        chapterId: id(value.chapterId, "chapterId"),
        title: title(value.title, "title"),
      };
    case "editStep": {
      onlyKeys(value, ["op", "stepId", "title", "approach"], "editStep");
      if (value.title === undefined && value.approach === undefined) invalid("editStep is empty");
      return {
        op: "editStep",
        stepId: id(value.stepId, "stepId"),
        ...(value.title === undefined ? {} : { title: title(value.title, "title") }),
        ...(value.approach === undefined ? {} : { approach: approach(value.approach) }),
      };
    }
    case "reorderSteps": {
      onlyKeys(value, ["op", "chapterId", "stepIds"], "reorderSteps");
      const { stepIds } = value;
      if (!Array.isArray(stepIds) || stepIds.length > PLAN_EDIT_LIMITS.maxStepsPerChapter) {
        invalid("stepIds is not a bounded list");
      }
      return {
        op: "reorderSteps",
        chapterId: id(value.chapterId, "chapterId"),
        stepIds: stepIds.map((entry) => id(entry, "stepIds")),
      };
    }
    case "addStep":
      onlyKeys(value, ["op", "chapterId", "title", "approach"], "addStep");
      return {
        op: "addStep",
        chapterId: id(value.chapterId, "chapterId"),
        title: title(value.title, "title"),
        ...(value.approach === undefined ? {} : { approach: approach(value.approach) }),
      };
    case "deleteStep":
      onlyKeys(value, ["op", "stepId"], "deleteStep");
      return { op: "deleteStep", stepId: id(value.stepId, "stepId") };
  }
}

/** Strict: exactly `version` and `edit`, and an edit this API knows. */
export function parsePlanEditRequest(value: unknown): PlanEditRequest {
  if (!isRecord(value)) invalid("body is not an object");
  onlyKeys(value, ["version", "edit"], "body");
  const { version } = value;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    invalid("version is not a non-negative integer");
  }
  return { version, edit: parseEdit(value.edit) };
}

/** True for text with no hard factual claim in it. */
const isUnclaimed = (text: string): boolean => detectFactualClaims(text).length === 0;

/** The text, or `""` when it makes a claim that would now have no source. */
const unclaimed = (text: string): string => (isUnclaimed(text) ? text : "");

/** Steps' `index` is display only; keep it equal to the current position. */
function reindexed(chapter: MissionChapter, steps: MissionStep[]): MissionChapter {
  return { ...chapter, steps: steps.map((step, index) => ({ ...step, index })) };
}

/**
 * Apply one edit to a plan. Pure: the same plan and edit always give the same
 * result, and the input is never mutated. Ids are never reused: an added step
 * takes the next number from `addedStepCount`, which only increases.
 */
export function applyPlanEdit(mission: MissionDraft, edit: PlanEdit): MissionDraft {
  const chapterOf = (stepId: string) => {
    const index = mission.chapters.findIndex((chapter) =>
      chapter.steps.some((step) => step.id === stepId),
    );
    if (index < 0) invalid("step id is not in this mission");
    return index;
  };
  const chapterById = (chapterId: string) => {
    const index = mission.chapters.findIndex((chapter) => chapter.id === chapterId);
    if (index < 0) invalid("chapter id is not in this mission");
    return index;
  };
  const replaceChapter = (index: number, chapter: MissionChapter): MissionDraft => ({
    ...mission,
    chapters: mission.chapters.map((entry, position) => (position === index ? chapter : entry)),
  });

  switch (edit.op) {
    case "renameChapter": {
      const index = chapterById(edit.chapterId);
      return replaceChapter(index, { ...mission.chapters[index]!, title: edit.title });
    }

    case "editStep": {
      const index = chapterOf(edit.stepId);
      const chapter = mission.chapters[index]!;
      const step = chapter.steps.find((entry) => entry.id === edit.stepId)!;
      const titleChanged = edit.title !== undefined && edit.title !== step.title.trim();
      const approachChanged =
        edit.approach !== undefined && edit.approach !== step.guide.approach.trim();
      // Nothing differs: saving would only strip sources for no reason.
      if (!titleChanged && !approachChanged) return mission;

      // Once the step loses its sources, any model-written guide text left in
      // it must not assert an unsourced fact (law 6). The deterministic claim
      // detector runs over what the person did not rewrite; no model is called.
      const guide =
        step.writtenBy === "person"
          ? step.guide
          : {
              approach: approachChanged ? step.guide.approach : unclaimed(step.guide.approach),
              materials: step.guide.materials.filter(isUnclaimed),
              commonMistakes: step.guide.commonMistakes.filter(isUnclaimed),
              whatGoodLooksLike: unclaimed(step.guide.whatGoodLooksLike),
            };
      return replaceChapter(index, {
        ...chapter,
        steps: chapter.steps.map((entry) =>
          entry.id !== edit.stepId
            ? entry
            : {
                ...entry,
                ...(titleChanged ? { title: edit.title! } : {}),
                guide: { ...guide, ...(approachChanged ? { approach: edit.approach! } : {}) },
                // The words are now the person's: no source vouches for them.
                sources: [],
                writtenBy: "person" as const,
              },
        ),
      });
    }

    case "reorderSteps": {
      const index = chapterById(edit.chapterId);
      const chapter = mission.chapters[index]!;
      const current = chapter.steps.map((step) => step.id);
      const proposed = new Set(edit.stepIds);
      if (
        proposed.size !== edit.stepIds.length ||
        edit.stepIds.length !== current.length ||
        !current.every((stepId) => proposed.has(stepId))
      ) {
        invalid("stepIds is not a reordering of the chapter's steps");
      }
      const byId = new Map(chapter.steps.map((step) => [step.id, step]));
      return replaceChapter(
        index,
        reindexed(
          chapter,
          edit.stepIds.map((stepId) => byId.get(stepId)!),
        ),
      );
    }

    case "addStep": {
      const index = chapterById(edit.chapterId);
      const chapter = mission.chapters[index]!;
      if (chapter.steps.length >= PLAN_EDIT_LIMITS.maxStepsPerChapter) {
        invalid("chapter is at its step limit");
      }
      const count = (mission.addedStepCount ?? 0) + 1;
      const added: MissionStep = {
        id: addedStepId(count),
        index: chapter.steps.length,
        title: edit.title,
        // No estimate: nobody estimated it, and the UI shows none for 0.
        estimatedMinutes: 0,
        verification: "SELF",
        guide: {
          approach: edit.approach ?? "",
          materials: [],
          commonMistakes: [],
          whatGoodLooksLike: "",
        },
        sources: [],
        toolKinds: [],
        writtenBy: "person",
      };
      return {
        ...replaceChapter(index, { ...chapter, steps: [...chapter.steps, added] }),
        addedStepCount: count,
      };
    }

    case "deleteStep": {
      const index = chapterOf(edit.stepId);
      const chapter = mission.chapters[index]!;
      if (chapter.steps.length <= 1) invalid("deleting a chapter's last step removes the chapter");
      return replaceChapter(
        index,
        reindexed(
          chapter,
          chapter.steps.filter((step) => step.id !== edit.stepId),
        ),
      );
    }
  }
}

export async function editPlan(
  input: EditPlanInput,
  ports: EditPlanPorts,
): Promise<StoredMissionView> {
  const request = parsePlanEditRequest(input.request);
  const view = await readMission(
    { principal: input.principal, missionId: input.missionId },
    { persistence: ports.persistence },
  );
  if (request.version !== view.version) {
    throw new GenerationError("PLAN_EDIT_CONFLICT", "edit made against an older version");
  }

  const mission = applyPlanEdit(view.mission, request.edit);
  // A no-op edit saves nothing and keeps the version.
  if (mission === view.mission) return view;
  const outcome = await storeCall(() =>
    ports.plans.update(input.principal.id, view.missionId, view.version, mission),
  );
  if (outcome === "conflict") {
    throw new GenerationError("PLAN_EDIT_CONFLICT", "version moved during the edit");
  }
  if (outcome === "missing") {
    throw new GenerationError("MISSION_NOT_FOUND", "mission vanished during the edit");
  }
  return { ...view, mission, version: view.version + 1 };
}
