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

  it("emits scored chapters only after grounding and safety complete", async () => {
    const events: { stage: string; status: string; hasChapter: boolean }[] = [];
    await generateMission({ rawText: "run a half marathon" }, (e) =>
      events.push({ stage: e.stage, status: e.status, hasChapter: Boolean(e.chapter) }),
    );
    const chapterEvents = events.filter((e) => e.hasChapter);
    expect(chapterEvents).toHaveLength(2);
    const safetyDone = events.findIndex((e) => e.stage === "safety" && e.status === "done");
    expect(safetyDone).toBeGreaterThan(-1);
    expect(events.findIndex((e) => e.hasChapter)).toBeGreaterThan(safetyDone);
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
        rewrites: [
          {
            issueId: "ground:0:0:guide.approach:scalar",
            rewrittenText: "Budget for this session in advance.",
          },
        ],
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

  it.each([
    { label: "missing", rewrites: [] },
    {
      label: "duplicate",
      rewrites: [
        { issueId: "ground:0:0:guide.approach:scalar", rewrittenText: "Advice." },
        { issueId: "ground:0:0:guide.approach:scalar", rewrittenText: "Advice." },
      ],
    },
    { label: "unknown", rewrites: [{ issueId: "ground:9:9:title:scalar", rewrittenText: "Advice." }] },
  ])("fails closed for a $label rewrite ID set", async ({ rewrites }) => {
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "This costs $500.", sources: [] }), step()],
    });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({ rewrites }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const events: { chapter?: unknown }[] = [];
    await expect(generateMission({ rawText: "run" }, (event) => events.push(event))).rejects.toThrow();
    expect(events.some((event) => event.chapter)).toBe(false);
  });

  it("fails closed when a grounding rewrite remains ungrounded", async () => {
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "This costs $500.", sources: [] }), step()],
    });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "ground:0:0:guide.approach:scalar",
            rewrittenText: "This still costs $400.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const events: { chapter?: unknown }[] = [];
    await expect(generateMission({ rawText: "run" }, (event) => events.push(event))).rejects.toThrow(
      "grounding rewrite did not resolve",
    );
    expect(events.some((event) => event.chapter)).toBe(false);
  });

  it("rewrites the exact unsafe field and fails closed if it remains unsafe", async () => {
    resolveMock.mockResolvedValue({ ...baseResolved, safetyClass: "CLINICAL" });
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "Eat 1200 kcal each day." }), step()],
    });
    detailChapterMock.mockResolvedValue({ steps: [step(), step({ title: "Run 4km easy" })] });
    completeMock.mockResolvedValue({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "safety:0:0:guide.approach:scalar",
            rewrittenText: "Eat 1300 kcal each day.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const events: { chapter?: unknown }[] = [];
    await expect(generateMission({ rawText: "run" }, (event) => events.push(event))).rejects.toThrow(
      "safety rewrite did not resolve",
    );
    expect(events.some((event) => event.chapter)).toBe(false);
  });

  it("fails closed when a successful safety rewrite introduces an ungrounded claim", async () => {
    resolveMock.mockResolvedValue({ ...baseResolved, safetyClass: "CLINICAL" });
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "Eat 1200 kcal each day." }), step()],
    });
    detailChapterMock.mockResolvedValue({ steps: [step(), step({ title: "Run 4km easy" })] });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "safety:0:0:guide.approach:scalar",
            rewrittenText: "The consultation costs $500.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const events: { chapter?: unknown }[] = [];
    await expect(generateMission({ rawText: "run" }, (event) => events.push(event))).rejects.toThrow(
      "safety rewrite introduced an ungrounded finding",
    );
    expect(events.some((event) => event.chapter)).toBe(false);
  });

  it("preserves initial safety redactions after a successful rewrite", async () => {
    resolveMock.mockResolvedValue({ ...baseResolved, safetyClass: "CLINICAL" });
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "Eat 1200 kcal each day." }), step()],
    });
    detailChapterMock.mockResolvedValue({ steps: [step(), step({ title: "Run 4km easy" })] });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "safety:0:0:guide.approach:scalar",
            rewrittenText: "Bring your nutrition plan to a clinician.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const result = await generateMission({ rawText: "run" });
    expect(result.event?.payload.safety.redactions).toEqual(["1200 kcal"]);
  });

  it("forwards the exact AbortSignal through later stages and rewrite model calls", async () => {
    const controller = new AbortController();
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "This costs $500.", sources: [] }), step()],
    });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "ground:0:0:guide.approach:scalar",
            rewrittenText: "Plan a suitable budget.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    await generateMission({ rawText: "run" }, undefined, { signal: controller.signal });
    expect(resolveMock).toHaveBeenCalledWith(baseInterpretation, controller.signal);
    expect(planMock).toHaveBeenCalledWith(baseInterpretation, baseResolved, controller.signal);
    expect(detailChapterMock).toHaveBeenCalledWith(expect.any(Object), controller.signal);
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "ground", signal: controller.signal }),
    );
  });

  it("propagates one AbortSignal to active model work and does not run later stages", async () => {
    const controller = new AbortController();
    interpretMock.mockImplementation((_input: unknown, signal: AbortSignal) => {
      expect(signal).toBe(controller.signal);
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const pending = generateMission({ rawText: "run" }, undefined, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(resolveMock).not.toHaveBeenCalled();
    expect(planMock).not.toHaveBeenCalled();
  });
});
