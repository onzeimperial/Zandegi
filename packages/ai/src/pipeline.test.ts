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
const { ModelOutputError, parseStageJson, verificationEnum } = await import("./schemas");
const { z } = await import("zod");

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

function rejectedOutput() {
  return new ModelOutputError("detail", "schema_mismatch", "bad output", [
    { path: "steps.6.verification", code: "invalid_value", received: '"PRACTICE"' },
  ]);
}

describe("parseStageJson", () => {
  const schema = z.object({ steps: z.array(z.object({ verification: verificationEnum })) });

  it("names the field and the value the model sent", () => {
    const failure = (() => {
      try {
        return parseStageJson(
          "detail",
          JSON.stringify({ steps: [{ verification: "SELF" }, { verification: "PRACTICE" }] }),
          schema,
        );
      } catch (error) {
        return error;
      }
    })() as InstanceType<typeof ModelOutputError>;

    expect(failure).toBeInstanceOf(ModelOutputError);
    expect(failure.kind).toBe("schema_mismatch");
    expect(failure.issues).toEqual([
      { path: "steps.1.verification", code: "invalid_value", received: '"PRACTICE"' },
    ]);
    expect(failure.message).toContain('steps.1.verification invalid_value received "PRACTICE"');
  });

  it("keeps model prose out of the message, because messages reach the logs", () => {
    const prose = "my private medical history";
    expect(() => parseStageJson("detail", `not json ${prose}`, schema)).toThrow(ModelOutputError);
    try {
      parseStageJson("detail", `not json ${prose}`, schema);
    } catch (error) {
      expect((error as Error).message).not.toContain(prose);
    }
    try {
      parseStageJson("detail", JSON.stringify({ steps: prose }), schema);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(prose);
      expect((error as Error).message).not.toContain(prose);
    }
  });
});

describe("rejected model output", () => {
  it("retries a rejected chapter and keeps the mission", async () => {
    const onOutputRejected = vi.fn();
    detailChapterMock.mockRejectedValueOnce(rejectedOutput());

    const result = await generateMissionDraft({ rawText: "run" }, undefined, { onOutputRejected });

    expect(result.draft?.mission.chapters).toHaveLength(2);
    // Two chapters plus the one retry.
    expect(detailChapterMock).toHaveBeenCalledTimes(3);
  });

  it("reports a rejection the retry recovered from, so it cannot hide", async () => {
    const onOutputRejected = vi.fn();
    detailChapterMock.mockRejectedValueOnce(rejectedOutput());

    await generateMissionDraft({ rawText: "run" }, undefined, { onOutputRejected });

    expect(onOutputRejected).toHaveBeenCalledTimes(1);
    expect(onOutputRejected).toHaveBeenCalledWith({
      stage: "detail",
      chapterIndex: 0,
      attempt: 1,
      willRetry: true,
      kind: "schema_mismatch",
      model: expect.any(String),
      issues: [{ path: "steps.6.verification", code: "invalid_value", received: '"PRACTICE"' }],
    });
  });

  it("stops after the second rejection and reports that it gave up", async () => {
    const onOutputRejected = vi.fn();
    detailChapterMock.mockRejectedValue(rejectedOutput());

    await expect(
      generateMissionDraft({ rawText: "run" }, undefined, { onOutputRejected }),
    ).rejects.toBeInstanceOf(ModelOutputError);

    const last = onOutputRejected.mock.calls.at(-1)![0] as { attempt: number; willRetry: boolean };
    expect(last).toMatchObject({ attempt: 2, willRetry: false });
    // Bounded: no chapter is ever tried a third time.
    const attempts = onOutputRejected.mock.calls.map(
      (call) => (call[0] as { attempt: number }).attempt,
    );
    expect(Math.max(...attempts)).toBe(2);
  });

  it("retries the plan stage too", async () => {
    planMock.mockRejectedValueOnce(
      new ModelOutputError("plan", "schema_mismatch", "bad", [
        { path: "primaryDomain", code: "invalid_value", received: '"Fitness"' },
      ]),
    );
    const result = await generateMissionDraft({ rawText: "run" });
    expect(result.draft).toBeDefined();
    expect(planMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failure that asking again cannot fix", async () => {
    const onOutputRejected = vi.fn();
    planMock.mockRejectedValue(new Error("401 invalid x-api-key"));

    await expect(
      generateMissionDraft({ rawText: "run" }, undefined, { onOutputRejected }),
    ).rejects.toThrow("401");

    expect(planMock).toHaveBeenCalledTimes(1);
    expect(onOutputRejected).not.toHaveBeenCalled();
  });

  it("does not spend a retry once the run has been cancelled", async () => {
    const controller = new AbortController();
    planMock.mockImplementation(async () => {
      controller.abort();
      throw rejectedOutput();
    });

    await expect(
      generateMissionDraft({ rawText: "run" }, undefined, { signal: controller.signal }),
    ).rejects.toBeDefined();

    expect(planMock).toHaveBeenCalledTimes(1);
  });

  it("survives a reporter that throws", async () => {
    detailChapterMock.mockRejectedValueOnce(rejectedOutput());
    const result = await generateMissionDraft({ rawText: "run" }, undefined, {
      onOutputRejected: () => {
        throw new Error("logging is down");
      },
    });
    expect(result.draft).toBeDefined();
  });
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

  it("short-circuits to a clarify refusal for impossible scope, without planning", async () => {
    interpretMock.mockResolvedValue({
      ...baseInterpretation,
      notes: { isImpossibleScope: true },
    });
    const result = await generateMissionDraft({ rawText: "become a billionaire by march" });
    expect(result.draft).toBeNull();
    expect(result.refusal?.route).toBe("clarify");
    expect(planMock).not.toHaveBeenCalled();
  });

  it("routes worrying details to support even when the goal also looks impossible", async () => {
    interpretMock.mockResolvedValue({ ...baseInterpretation, notes: { isImpossibleScope: true } });
    resolveMock.mockResolvedValue({ ...baseResolved, safetyClass: "SELF_HARM_ADJACENT" });
    const details = { why: "so the pain finally stops" };
    const result = await generateMissionDraft({ rawText: "run a half marathon", details });

    expect(result.refusal?.route).toBe("support");
    expect(resolveMock.mock.calls[0]![0]).toMatchObject({ details });
    expect(planMock).not.toHaveBeenCalled();
    expect(detailChapterMock).not.toHaveBeenCalled();
  });

  it("overrides the model with stated hours, date and location, and passes details on", async () => {
    interpretMock.mockResolvedValue({
      ...baseInterpretation,
      constraints: { deadline: "2030-01-01", currentLevel: "new" },
      timeBudgetMinutesPerWeek: 999,
      location: "Mars",
    });
    const details = { targetDate: "2027-04-01", startingPoint: "I can jog 2km" };
    await generateMissionDraft({
      rawText: "run a half marathon",
      weeklyTimeBudgetMinutes: 150,
      location: "Melbourne",
      details,
    });

    const expected = {
      timeBudgetMinutesPerWeek: 150,
      location: "Melbourne",
      constraints: { deadline: "2027-04-01", currentLevel: "new" },
      details,
    };
    expect(planMock.mock.calls[0]![0]).toMatchObject(expected);
    expect(detailChapterMock.mock.calls[0]![0].interpretation).toMatchObject(expected);
  });

  it("leaves the model's inference alone for a goal on its own", async () => {
    await generateMissionDraft({ rawText: "run a half marathon" });
    expect(planMock.mock.calls[0]![0]).toEqual(baseInterpretation);
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

  it("omits a claim the grounding rewrite could not fix, so it never ships", async () => {
    detailChapterMock.mockResolvedValueOnce({
      steps: [step({ approach: "This costs $500.", sources: [] }), step()],
    });
    completeMock.mockResolvedValueOnce({
      text: JSON.stringify({
        rewrites: [
          {
            issueId: "ground:0:0:guide.approach:scalar",
            // The rewrite model kept a price -- the failure seen on a real run.
            rewrittenText: "This still costs $400.",
          },
        ],
      }),
      model: "test-model",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const events: { chapter?: unknown }[] = [];

    // This used to discard the whole mission. Neither price may ship, but the
    // rest of the mission now survives.
    const result = await generateMissionDraft({ rawText: "run" }, (event) => events.push(event));

    const shipped = JSON.stringify(result.draft?.mission);
    expect(shipped).not.toContain("$500");
    expect(shipped).not.toContain("$400");
    expect(result.draft?.mission.chapters[0]?.steps[0]?.guide.approach).toBe(
      "Work through this step at a pace that suits you.",
    );
    expect(result.draft?.grounding).toMatchObject({ rewritten: 1, dropped: 1 });
    expect(result.draft?.grounding.ungroundedClaims).toEqual([]);
    expect(events.some((event) => event.chapter)).toBe(true);
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

  it("omits an ungrounded claim a safety rewrite introduces, so it never ships", async () => {
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
    // Previously this discarded the whole mission. The invariant that matters is
    // narrower and still holds: the unsourced price never reaches the user.
    const result = await generateMissionDraft({ rawText: "run" });

    expect(JSON.stringify(result.draft?.mission)).not.toContain("$500");
    expect(result.draft?.mission.chapters[0]?.steps[0]?.guide.approach).toBe(
      "Work through this step at a pace that suits you.",
    );
    expect(result.draft?.grounding.dropped).toBeGreaterThan(0);
    expect(result.draft?.grounding.ungroundedClaims).toEqual([]);
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
    // Detail receives a linked child signal now, so one failed chapter can cancel
    // its siblings. That an outer abort still reaches it is proven below, in
    // flight -- object identity never proved it.
    expect(detailChapterMock).toHaveBeenCalledWith(expect.any(Object), expect.any(AbortSignal));
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "ground", signal: controller.signal }),
    );
  });

  it("cancels an in-flight chapter when the client disconnects mid-detail", async () => {
    const controller = new AbortController();
    const seen: AbortSignal[] = [];
    detailChapterMock.mockImplementation((_input: unknown, signal: AbortSignal) => {
      seen.push(signal);
      // Disconnect while detail is still running, which is when it matters.
      controller.abort(new Error("client gone"));
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });

    await expect(
      generateMissionDraft({ rawText: "run" }, undefined, { signal: controller.signal }),
    ).rejects.toBeTruthy();

    expect(seen.length).toBeGreaterThan(0);
    for (const signal of seen) expect(signal.aborted).toBe(true);
  });

  it("details chapters concurrently rather than one round-trip at a time", async () => {
    let inFlight = 0;
    let peak = 0;
    detailChapterMock.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { steps: [step(), step()] };
    });
    planMock.mockResolvedValueOnce({
      missionTitle: "Half marathon",
      primaryDomain: "Body",
      chapters: Array.from({ length: 4 }, (_unused, index) => ({
        title: `Chapter ${index + 1}`,
        exitCondition: `Finish ${index + 1}`,
      })),
    });

    const result = await generateMissionDraft({ rawText: "run" });

    expect(peak).toBeGreaterThan(1);
    // Order follows the plan, not completion order.
    expect(result.draft?.mission.chapters.map((chapter) => chapter.title)).toEqual([
      "Chapter 1",
      "Chapter 2",
      "Chapter 3",
      "Chapter 4",
    ]);
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
