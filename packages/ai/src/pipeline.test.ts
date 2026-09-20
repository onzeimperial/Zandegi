import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Interpretation, ResolvedPursuit } from "./types";

const interpretMock = vi.fn();
const resolveMock = vi.fn();
const hydrateMock = vi.fn();
const planMock = vi.fn();
const detailChapterMock = vi.fn();
const completeMock = vi.fn();

vi.mock("./stages/01-interpret", () => ({ interpret: (...a: unknown[]) => interpretMock(...a) }));
vi.mock("./stages/02-resolve", () => ({ resolve: (...a: unknown[]) => resolveMock(...a) }));
vi.mock("./stages/03-hydrate", () => ({ hydrate: (...a: unknown[]) => hydrateMock(...a) }));
vi.mock("./stages/04-plan", () => ({ plan: (...a: unknown[]) => planMock(...a) }));
vi.mock("./stages/05-detail", () => ({ detailChapter: (...a: unknown[]) => detailChapterMock(...a) }));
vi.mock("./router", async () => {
  const actual = await vi.importActual<typeof import("./router")>("./router");
  return { ...actual, complete: (...a: unknown[]) => completeMock(...a) };
});

const { generateMission } = await import("./pipeline");

const baseInterpretation: Interpretation = {
  intent: "Run a half marathon",
  goalType: "METRIC",
  constraints: {},
  timeBudgetMinutesPerWeek: 240,
  pursuitMatches: [],
  notes: {},
};
const baseResolved: ResolvedPursuit = {
  slug: "run-a-half-marathon",
  domains: { Body: 1 },
  goalType: "METRIC",
  effortBand: "SEASON",
  safetyClass: "NORMAL",
  difficultyPrior: 1,
  antiPatterns: [],
  usedGenericScaffold: true,
};

function step(overrides: Partial<{ title: string; approach: string; sources: unknown[] }> = {}) {
  return {
    title: overrides.title ?? "Run 3km easy",
    estimatedMinutes: 30,
    verification: "TIMER",
    guide: {
      approach: overrides.approach ?? "Jog at a conversational pace.",
      materials: [],
      commonMistakes: [],
      whatGoodLooksLike: "You finish able to talk.",
    },
    sources: overrides.sources ?? [],
    toolKinds: [],
  };
}

beforeEach(() => {
  interpretMock.mockReset();
  resolveMock.mockReset();
  hydrateMock.mockReset();
  planMock.mockReset();
  detailChapterMock.mockReset();
  completeMock.mockReset();
  interpretMock.mockResolvedValue(baseInterpretation);
  resolveMock.mockResolvedValue(baseResolved);
  hydrateMock.mockResolvedValue([]);
  planMock.mockResolvedValue({
    missionTitle: "Half Marathon",
    primaryDomain: "Body",
    chapters: [
      { title: "Base building", exitCondition: "Run 3x/week for 4 weeks" },
      { title: "Distance building", exitCondition: "Complete a 15km long run" },
    ],
  });
  detailChapterMock.mockResolvedValue({ steps: [step(), step({ title: "Run 4km easy" })] });
});

describe("generateMission", () => {
  it("runs the full pipeline and returns a MissionGenerated event", async () => {
    const result = await generateMission({ rawText: "run a half marathon in april" });
    expect(result.refusal).toBeUndefined();
    expect(result.event?.type).toBe("MissionGenerated");
    expect(result.event?.payload.mission.chapters).toHaveLength(2);
    expect(result.event?.payload.mission.completionXp).toBeGreaterThan(0);
    expect(result.event?.payload.generationMeta.modelsUsed.interpret).toBeDefined();
    expect(result.event?.payload.generationMeta.modelsUsed.score).toBeUndefined();
    expect(result.event?.payload.generationMeta.modelsUsed.hydrate).toBeUndefined();
  });

  it("emits a StageEvent with a scored chapter for each chapter, progressively", async () => {
    const events: { stage: string; status: string; hasChapter: boolean }[] = [];
    await generateMission({ rawText: "run a half marathon" }, (e) =>
      events.push({ stage: e.stage, status: e.status, hasChapter: Boolean(e.chapter) }),
    );
    const chapterEvents = events.filter((e) => e.hasChapter);
    expect(chapterEvents).toHaveLength(2);
  });

  it("short-circuits to a clarify refusal for impossible scope, without calling resolve", async () => {
    interpretMock.mockResolvedValue({
      ...baseInterpretation,
      notes: { isImpossibleScope: true },
    });
    const result = await generateMission({ rawText: "become a billionaire by march" });
    expect(result.event).toBeNull();
    expect(result.refusal?.route).toBe("clarify");
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("short-circuits to a support refusal for SELF_HARM_ADJACENT, without planning/detailing", async () => {
    resolveMock.mockResolvedValue({ ...baseResolved, safetyClass: "SELF_HARM_ADJACENT" });
    const result = await generateMission({ rawText: "i want to die less" });
    expect(result.event).toBeNull();
    expect(result.refusal?.route).toBe("support");
    expect(planMock).not.toHaveBeenCalled();
    expect(detailChapterMock).not.toHaveBeenCalled();
  });

  it("calls the model to rewrite an ungrounded factual claim, then re-validates clean", async () => {
    detailChapterMock.mockResolvedValueOnce({
      steps: [
        step({ approach: "This costs $500 and is due by December 2024.", sources: [] }),
        step({ title: "Run 4km easy" }),
      ],
    });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [{ chapterIndex: 0, stepIndex: 0, rewrittenApproach: "Budget for this session in advance." }],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const result = await generateMission({ rawText: "run a half marathon" });
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ stage: "ground" }));
    expect(result.event?.payload.grounding.ungroundedClaims).toEqual([]);
    expect(result.event?.payload.mission.chapters[0]?.steps[0]?.guide.approach).toBe(
      "Budget for this session in advance.",
    );
  });

  it("propagates a stage error and emits an error event", async () => {
    interpretMock.mockRejectedValue(new Error("model unavailable"));
    const events: { stage: string; status: string }[] = [];
    await expect(
      generateMission({ rawText: "x" }, (e) => events.push({ stage: e.stage, status: e.status })),
    ).rejects.toThrow("model unavailable");
    expect(events).toContainEqual({ stage: "interpret", status: "error" });
  });
});
