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
vi.mock("./stages/05-detail", () => ({
  detailChapter: (...a: unknown[]) => detailChapterMock(...a),
}));
vi.mock("./router", async () => {
  const actual = await vi.importActual<typeof import("./router")>("./router");
  return { ...actual, complete: (...a: unknown[]) => completeMock(...a) };
});

const pipeline = await import("./pipeline");

const NOW = new Date("2026-06-15T00:00:00Z");

type DraftOptions = Parameters<typeof pipeline.generateMissionDraft>[2];

// Production injects the request-scoped instant through the API clock port.
// These tests go through the real signature, defaulting only the instant so
// each case stays about the behaviour it is actually testing.
const generateMissionDraft = (
  input: Parameters<typeof pipeline.generateMissionDraft>[0],
  onEvent?: Parameters<typeof pipeline.generateMissionDraft>[1],
  options: Partial<DraftOptions> = {},
) => pipeline.generateMissionDraft(input, onEvent, { asOf: NOW, ...options });

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
  it("runs the full pipeline and returns a validated draft with no XP and no event", async () => {
    const result = await generateMissionDraft({ rawText: "run a half marathon in april" });
    expect(result.refusal).toBeUndefined();
    expect(result.draft?.mission.chapters).toHaveLength(2);
    expect(result.draft?.goalText).toBe("run a half marathon in april");
    expect(result.draft?.pursuitSlug).toBe("run-a-half-marathon");
    expect(result.draft?.modelsUsed.interpret).toBeDefined();
    expect(result.draft?.modelsUsed.hydrate).toBeUndefined();
    // Law 3/5: generation promises no progression number, and law 4: it
    // fabricates no ledger fact.
    expect(JSON.stringify(result)).not.toMatch(
      /"(?:baseXp|completionXp)"|MissionGenerated|occurredAt/,
    );
  });

  it("emits draft chapters only after grounding and safety complete", async () => {
    const events: { stage: string; status: string; hasChapter: boolean }[] = [];
    await generateMissionDraft({ rawText: "run a half marathon" }, (e) =>
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
    const result = await generateMissionDraft({ rawText: "become a billionaire by march" });
    expect(result.draft).toBeNull();
    expect(result.refusal?.route).toBe("clarify");
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("short-circuits to a support refusal for SELF_HARM_ADJACENT, without planning/detailing", async () => {
    resolveMock.mockResolvedValue({ ...baseResolved, safetyClass: "SELF_HARM_ADJACENT" });
    const result = await generateMissionDraft({ rawText: "i want to die less" });
    expect(result.draft).toBeNull();
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
    const result = await generateMissionDraft({ rawText: "run a half marathon" });
    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ stage: "ground" }));
    expect(result.draft?.grounding.ungroundedClaims).toEqual([]);
    expect(result.draft?.mission.chapters[0]?.steps[0]?.guide.approach).toBe(
      "Budget for this session in advance.",
    );
  });

  // The pair below pins that freshness is judged against the *injected*
  // instant. One source, one claim, two instants, two outcomes: swap
  // `options.asOf` for an ambient `new Date()` in the pipeline and the first
  // case fails, because today's clock puts this source back inside the window.
  const feeSource = [{ title: "Official fee schedule", date: "2028-08-01" }];

  it("judges a source against the injected instant, not an ambient clock", async () => {
    detailChapterMock.mockResolvedValueOnce({
      steps: [
        step({ approach: "The application fee is $500.", sources: feeSource }),
        step({ title: "Run 4km easy" }),
      ],
    });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "ground:0:0:guide.approach:scalar",
            rewrittenText: "Check the current fee before you apply.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });

    // At NOW (2026-06-15) a 2028-08-01 source is past the two-year horizon, so
    // it cannot back the claim and the claim is ungrounded.
    const result = await generateMissionDraft({ rawText: "apply to medicine" });

    expect(completeMock).toHaveBeenCalledWith(expect.objectContaining({ stage: "ground" }));
    expect(result.draft?.grounding.rewritten).toBe(1);
    expect(result.draft?.mission.chapters[0]?.steps[0]?.guide.approach).toBe(
      "Check the current fee before you apply.",
    );
  });

  it("accepts that same source once the injected instant is late enough", async () => {
    detailChapterMock.mockResolvedValueOnce({
      steps: [
        step({ approach: "The application fee is $500.", sources: feeSource }),
        step({ title: "Run 4km easy" }),
      ],
    });

    const result = await generateMissionDraft({ rawText: "apply to medicine" }, undefined, {
      asOf: new Date("2027-01-01T00:00:00Z"),
    });

    expect(completeMock).not.toHaveBeenCalled();
    expect(result.draft?.grounding.ungroundedClaims).toEqual([]);
    expect(result.draft?.mission.chapters[0]?.steps[0]?.guide.approach).toBe(
      "The application fee is $500.",
    );
  });

  it("propagates a stage error and emits an error event", async () => {
    interpretMock.mockRejectedValue(new Error("model unavailable"));
    const events: { stage: string; status: string }[] = [];
    await expect(
      generateMissionDraft({ rawText: "x" }, (e) =>
        events.push({ stage: e.stage, status: e.status }),
      ),
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
    {
      label: "unknown",
      rewrites: [{ issueId: "ground:9:9:title:scalar", rewrittenText: "Advice." }],
    },
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
    await expect(
      generateMissionDraft({ rawText: "run" }, (event) => events.push(event)),
    ).rejects.toThrow();
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
    await expect(
      generateMissionDraft({ rawText: "run" }, (event) => events.push(event)),
    ).rejects.toThrow("grounding rewrite did not resolve");
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
    await expect(
      generateMissionDraft({ rawText: "run" }, (event) => events.push(event)),
    ).rejects.toThrow("safety rewrite did not resolve");
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
    await expect(
      generateMissionDraft({ rawText: "run" }, (event) => events.push(event)),
    ).rejects.toThrow("safety rewrite introduced an ungrounded finding");
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
    const result = await generateMissionDraft({ rawText: "run" });
    expect(result.draft?.safety.redactions).toEqual(["1200 kcal"]);
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
    await generateMissionDraft({ rawText: "run" }, undefined, { signal: controller.signal });
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
    const pending = generateMissionDraft({ rawText: "run" }, undefined, {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(resolveMock).not.toHaveBeenCalled();
    expect(planMock).not.toHaveBeenCalled();
  });
});
