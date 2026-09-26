import type { DraftChapter, DraftStep, RewriteIssue, TextFieldLocation } from "./types";

export interface TextFieldValue extends TextFieldLocation {
  text: string;
}

export interface RewriteValue {
  issueId: string;
  rewrittenText: string;
}

export function issueId(stage: "ground" | "safety", location: TextFieldLocation): string {
  const item = location.itemIndex === undefined ? "scalar" : String(location.itemIndex);
  return `${stage}:${location.chapterIndex}:${location.stepIndex}:${location.field}:${item}`;
}

export function stepTextFields(
  chapterIndex: number,
  stepIndex: number,
  step: DraftStep,
): TextFieldValue[] {
  return [
    { chapterIndex, stepIndex, field: "title", text: step.title },
    { chapterIndex, stepIndex, field: "guide.approach", text: step.guide.approach },
    ...step.guide.materials.map((text, itemIndex) => ({
      chapterIndex,
      stepIndex,
      field: "guide.materials" as const,
      itemIndex,
      text,
    })),
    ...step.guide.commonMistakes.map((text, itemIndex) => ({
      chapterIndex,
      stepIndex,
      field: "guide.commonMistakes" as const,
      itemIndex,
      text,
    })),
    {
      chapterIndex,
      stepIndex,
      field: "guide.whatGoodLooksLike",
      text: step.guide.whatGoodLooksLike,
    },
  ];
}

function resolveTarget(chapters: DraftChapter[], location: TextFieldLocation): () => void {
  const step = chapters[location.chapterIndex]?.steps[location.stepIndex];
  if (!step) throw new Error("rewrite target is invalid");

  if (location.field === "title") return () => undefined;
  if (location.field === "guide.approach") return () => undefined;
  if (location.field === "guide.whatGoodLooksLike") return () => undefined;

  const values =
    location.field === "guide.materials" ? step.guide.materials : step.guide.commonMistakes;
  if (location.itemIndex === undefined || values[location.itemIndex] === undefined) {
    throw new Error("rewrite target is invalid");
  }
  return () => undefined;
}

function setTarget(chapters: DraftChapter[], location: TextFieldLocation, value: string): void {
  const step = chapters[location.chapterIndex]!.steps[location.stepIndex]!;
  if (location.field === "title") step.title = value;
  else if (location.field === "guide.approach") step.guide.approach = value;
  else if (location.field === "guide.whatGoodLooksLike") step.guide.whatGoodLooksLike = value;
  else if (location.field === "guide.materials") step.guide.materials[location.itemIndex!] = value;
  else step.guide.commonMistakes[location.itemIndex!] = value;
}

/** Validates the complete ID set and every target before mutating anything. */
export function applyExactRewrites(
  chapters: DraftChapter[],
  issues: readonly RewriteIssue[],
  rewrites: readonly RewriteValue[],
): void {
  const expected = new Map(issues.map((entry) => [entry.issueId, entry]));
  if (expected.size !== issues.length || rewrites.length !== issues.length) {
    throw new Error("rewrite response did not contain the exact issue set");
  }

  const seen = new Set<string>();
  for (const rewrite of rewrites) {
    const target = expected.get(rewrite.issueId);
    if (!target || seen.has(rewrite.issueId)) {
      throw new Error("rewrite response did not contain the exact issue set");
    }
    seen.add(rewrite.issueId);
    resolveTarget(chapters, target);
  }
  if (seen.size !== expected.size) throw new Error("rewrite response did not contain the exact issue set");

  for (const rewrite of rewrites) setTarget(chapters, expected.get(rewrite.issueId)!, rewrite.rewrittenText);
}
