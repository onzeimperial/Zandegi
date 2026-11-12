import { describe, expect, it } from "vitest";
import type { DraftChapter, StageEvent } from "@zandegi/ai";
import { toProgress } from "./mapping";

const chapter: DraftChapter = {
  index: 0,
  title: "Base building",
  exitCondition: "Run 3x a week for four weeks",
  steps: [
    {
      index: 0,
      title: "Run 3km easy",
      estimatedMinutes: 30,
      verification: "TIMER",
      guide: {
        approach: "Jog at a conversational pace.",
        materials: [],
        commonMistakes: [],
        whatGoodLooksLike: "You finish able to talk.",
      },
      sources: [],
      toolKinds: [],
    },
  ],
};

describe("toProgress", () => {
  it("drops detail from an error event, so no stage trace or model text reaches the wire", () => {
    const event: StageEvent = {
      stage: "detail",
      status: "error",
      detail: "detailChapter failed: model returned 'I cannot help with that'",
    };

    const progress = toProgress(event);

    expect(Object.keys(progress)).toEqual(["stage", "status"]);
    expect(progress).not.toHaveProperty("detail");
    expect(JSON.stringify(progress)).not.toContain("detailChapter");
  });

  it("drops a chapter smuggled onto an error event as well", () => {
    const progress = toProgress({ stage: "detail", status: "error", chapter });

    expect(Object.keys(progress)).toEqual(["stage", "status"]);
  });

  it("keeps the detail on a non-error event", () => {
    const progress = toProgress({ stage: "plan", status: "start", detail: "Writing steps" });

    expect(progress).toEqual({ stage: "plan", status: "start", detail: "Writing steps" });
  });

  it("maps a revealed chapter onto the client contract", () => {
    const progress = toProgress({ stage: "detail", status: "done", chapter });

    expect(progress.chapter).toEqual({
      id: "0",
      index: 0,
      title: "Base building",
      exitCondition: "Run 3x a week for four weeks",
      steps: [
        {
          id: "0:0",
          index: 0,
          title: "Run 3km easy",
          estimatedMinutes: 30,
          verification: "TIMER",
          guide: {
            approach: "Jog at a conversational pace.",
            materials: [],
            commonMistakes: [],
            whatGoodLooksLike: "You finish able to talk.",
          },
          sources: [],
          toolKinds: [],
        },
      ],
    });
    // The mapping copies field by field, so nothing extra can ride along.
    expect(progress.chapter).not.toBe(chapter);
  });

  it("omits an absent detail rather than emitting an undefined key", () => {
    expect(Object.keys(toProgress({ stage: "safety", status: "done" }))).toEqual([
      "stage",
      "status",
    ]);
  });
});
