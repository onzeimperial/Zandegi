import { describe, expect, it } from "vitest";
import { toMissionDraft } from "../generation/mapping";
import { isGeneratedStepId, upcastMission, type StoredMissionDraft } from "./ids";

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

const LEGACY: StoredMissionDraft = {
  title: "Learn Farsi",
  goalType: "PROJECT",
  primaryDomain: "Mind",
  chapters: [
    { index: 0, title: "Sounds", exitCondition: "Read aloud", steps: [step(0), step(1)] },
    { index: 1, title: "Words", exitCondition: "100 words", steps: [step(0)] },
  ],
};

describe("stable ids", () => {
  it("upcasts a mission stored before ids to its position ids", () => {
    const mission = upcastMission(LEGACY);
    expect(mission.chapters.map((chapter) => chapter.id)).toEqual(["0", "1"]);
    expect(mission.chapters.map((chapter) => chapter.steps.map((entry) => entry.id))).toEqual([
      ["0:0", "0:1"],
      ["1:0"],
    ]);
    // Same content otherwise, and the input is untouched.
    expect(mission.chapters[0]!.steps[1]!.title).toBe("Step 2");
    expect(LEGACY.chapters[0]).not.toHaveProperty("id");
  });

  it("is pure and leaves ids that exist alone", () => {
    const once = upcastMission(LEGACY);
    expect(upcastMission(once)).toEqual(once);
    expect(upcastMission(LEGACY)).toEqual(once);
    const reordered = {
      ...once,
      chapters: [{ ...once.chapters[0]!, steps: [...once.chapters[0]!.steps].reverse() }],
    };
    expect(upcastMission(reordered).chapters[0]!.steps.map((entry) => entry.id)).toEqual([
      "0:1",
      "0:0",
    ]);
  });

  it("generates new missions with the same position ids", () => {
    const mission = toMissionDraft({
      title: "t",
      goalType: "PROJECT",
      primaryDomain: "Mind",
      // A draft whose own index fields disagree with positions still gets position ids.
      chapters: [
        { index: 4, title: "a", exitCondition: "x", steps: [step(7)] },
        { index: 9, title: "b", exitCondition: "y", steps: [step(0), step(3)] },
      ],
    } as never);
    expect(mission.chapters.map((chapter) => chapter.steps.map((entry) => entry.id))).toEqual([
      ["0:0"],
      ["1:0", "1:1"],
    ]);
  });

  it("tells a generated step from one the person added", () => {
    expect(isGeneratedStepId("0:0")).toBe(true);
    expect(isGeneratedStepId("12:3")).toBe(true);
    expect(isGeneratedStepId("own-1")).toBe(false);
    expect(isGeneratedStepId("0:0:0")).toBe(false);
  });
});
