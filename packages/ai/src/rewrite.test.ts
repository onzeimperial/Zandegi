import { describe, expect, it } from "vitest";
import { applyExactRewrites, issueId } from "./rewrite";
import { parseStageJson, rewriteOutputSchema } from "./schemas";
import type { DraftChapter, RewriteIssue, TextFieldLocation } from "./types";

function chapters(): DraftChapter[] {
  return [
    {
      index: 0,
      title: "Chapter",
      exitCondition: "Done",
      steps: [
        {
          index: 0,
          title: "Original title",
          estimatedMinutes: 10,
          verification: "SELF",
          guide: {
            approach: "Original approach",
            materials: ["Original material", "Untargeted material"],
            commonMistakes: ["Original mistake", "Untargeted mistake"],
            whatGoodLooksLike: "Original outcome",
          },
          sources: [],
          toolKinds: [],
        },
      ],
    },
  ];
}

describe("applyExactRewrites", () => {
  it("sets every scalar and indexed target without changing untargeted fields", () => {
    const locations: TextFieldLocation[] = [
      { chapterIndex: 0, stepIndex: 0, field: "title" },
      { chapterIndex: 0, stepIndex: 0, field: "guide.approach" },
      { chapterIndex: 0, stepIndex: 0, field: "guide.materials", itemIndex: 0 },
      { chapterIndex: 0, stepIndex: 0, field: "guide.commonMistakes", itemIndex: 0 },
      { chapterIndex: 0, stepIndex: 0, field: "guide.whatGoodLooksLike" },
    ];
    const issues: RewriteIssue[] = locations.map((location) => ({
      ...location,
      issueId: issueId("ground", location),
      issue: "replace",
    }));
    const missionChapters = chapters();
    applyExactRewrites(
      missionChapters,
      issues,
      issues.map((issue, index) => ({ issueId: issue.issueId, rewrittenText: `Replacement ${index}` })),
    );

    const step = missionChapters[0]!.steps[0]!;
    expect(step.title).toBe("Replacement 0");
    expect(step.guide.approach).toBe("Replacement 1");
    expect(step.guide.materials).toEqual(["Replacement 2", "Untargeted material"]);
    expect(step.guide.commonMistakes).toEqual(["Replacement 3", "Untargeted mistake"]);
    expect(step.guide.whatGoodLooksLike).toBe("Replacement 4");
    expect(missionChapters[0]!.title).toBe("Chapter");
    expect(missionChapters[0]!.exitCondition).toBe("Done");
  });

  it("rejects whitespace-only rewrite content", () => {
    expect(() =>
      parseStageJson("ground", '{"rewrites":[{"issueId":"x","rewrittenText":"   "}]}', rewriteOutputSchema),
    ).toThrow(/schema validation/);
  });
});
