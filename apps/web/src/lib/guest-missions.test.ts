import {
  GenerationError,
  createDemoStore,
  demoPortsFromStore,
  foldProgress,
  upcastMission,
} from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRequestSession = vi.fn();
const redirect = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  email: "invited@example.com",
  failure: null as Error | null,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => {
    if (clerk.failure !== null) throw clerk.failure;
    return { userId: clerk.userId };
  },
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: clerk.email, verification: { status: "verified" } }],
  }),
}));

const request = vi.hoisted(() => ({ cookie: null as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(request.cookie === null ? {} : { cookie: request.cookie }),
}));
vi.mock("next/navigation", () => ({ redirect: (target: string) => redirect(target) }));
vi.mock("./session", async () => {
  const actual = await vi.importActual<typeof import("./session")>("./session");
  return { ...actual, resolveRequestSession: () => resolveRequestSession() };
});

const {
  loadGuestMissions,
  stepStates,
  estimateLabel,
  stepHref,
  stepIdParam,
  bossHref,
  nextAfterStep,
} = await import("./guest-missions");
const { default: GenerateLayout } = await import("@/app/generate/layout");

beforeEach(() => {
  request.cookie = null;
  redirect.mockClear();
  resolveRequestSession.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loading a person's missions for a page", () => {
  it.each(["SIGN_IN_REQUIRED", "ACCOUNT_NOT_ALLOWED", "GENERATION_DISABLED"] as const)(
    "sends %s home with no data",
    async (code) => {
      resolveRequestSession.mockRejectedValue(new GenerationError(code));
      await expect(loadGuestMissions()).rejects.toThrow("redirect:/");
    },
  );

  it("reports a store failure as unavailable rather than redirecting", async () => {
    resolveRequestSession.mockRejectedValue(new GenerationError("STORE_UNAVAILABLE"));
    await expect(loadGuestMissions()).resolves.toEqual({ status: "unavailable" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("treats guest mode with no cookie as a brand-new character", async () => {
    resolveRequestSession.mockResolvedValue(null);
    await expect(loadGuestMissions()).resolves.toMatchObject({
      status: "ready",
      missions: [],
      progress: { totalXp: 0, level: 1 },
    });
  });
});

describe("the generate page's guard", () => {
  const children = "the form";

  it("lets guest mode through", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    await expect(GenerateLayout({ children })).resolves.toBe(children);
    vi.unstubAllEnvs();
  });

  it("sends production with no keys home", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
    vi.unstubAllEnvs();
  });
});

describe("the generate page's guard with Clerk active", () => {
  const children = "the form";

  beforeEach(() => {
    clerk.userId = null;
    clerk.email = "invited@example.com";
    clerk.failure = null;
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("ZANDEGI_ALLOWED_EMAILS", "invited@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the form for an invited person", async () => {
    clerk.userId = "user_a";
    await expect(GenerateLayout({ children })).resolves.toBe(children);
  });

  it("sends someone not invited home", async () => {
    clerk.userId = "user_b";
    clerk.email = "stranger@example.com";
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
  });

  it("sends a signed-out person home", async () => {
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
  });

  it("sends everyone home when Clerk cannot answer", async () => {
    clerk.failure = new Error("clerk down");
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
  });
});

describe("step states by stable id", () => {
  const step = (id: string) => ({
    id,
    index: 0,
    title: id,
    estimatedMinutes: 0,
    verification: "SELF" as const,
    guide: { approach: "", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
    sources: [],
    toolKinds: [],
  });
  const mission = (stepIds: string[][]) => ({
    missionId: "m-1",
    generatedAt: "2026-11-12T00:00:00.000Z",
    pursuitSlug: "p",
    safetyClass: "NORMAL" as const,
    version: 0,
    mission: {
      title: "t",
      goalType: "PROJECT" as const,
      primaryDomain: "Mind" as const,
      chapters: stepIds.map((ids, index) => ({
        id: String(index),
        index,
        title: `c${index}`,
        exitCondition: "",
        steps: ids.map(step),
      })),
    },
  });
  const done = (...stepIds: string[]) =>
    foldProgress(
      stepIds.map((stepId) => ({
        version: 2 as const,
        eventId: stepId,
        missionId: "m-1",
        recordedAt: "2026-11-12T00:00:00.000Z",
        type: "StepCompleted" as const,
        chapterId: stepId.split(":")[0] ?? "0",
        stepId,
        evidence: { kind: "SELF" as const },
        award: { xp: 40, base: 40, verificationMult: 1, calculatorVersion: "neutral-v1" },
      })),
    );

  it("keeps a done step done after a reorder, and makes the first undone current", () => {
    const states = stepStates(mission([["0:1", "0:0"], ["1:0"]]), done("0:0"));
    expect(states.state("0:0")).toBe("done");
    expect(states.state("0:1")).toBe("current");
    expect(states.state("1:0")).toBe("upcoming");
    expect(states.current?.step.id).toBe("0:1");
    expect(states.current?.chapterNumber).toBe(1);
  });

  const boss = (chapterId: string, band: "done" | "not-yet") => ({
    version: 2 as const,
    eventId: `boss-${chapterId}-${band}`,
    missionId: "m-1",
    recordedAt: "2026-11-12T00:00:00.000Z",
    type: "BossResolved" as const,
    attemptId: `a-${chapterId}`,
    chapterId,
    band,
    evidence: { kind: "SELF" as const },
    xp: band === "done" ? 400 : 0,
    selfDeclared: true as const,
    calculatorVersion: "progression-v2",
  });
  const withEvents = (stepIds: string[], extra: ReturnType<typeof boss>[]) =>
    foldProgress([...readEventsOf(stepIds), ...extra]);
  const readEventsOf = (stepIds: string[]) =>
    stepIds.map((stepId) => ({
      version: 2 as const,
      eventId: stepId,
      missionId: "m-1",
      recordedAt: "2026-11-12T00:00:00.000Z",
      type: "StepCompleted" as const,
      chapterId: stepId.split(":")[0] ?? "0",
      stepId,
      evidence: { kind: "SELF" as const },
      award: { xp: 40, base: 40, verificationMult: 1, calculatorVersion: "neutral-v1" },
    }));

  it("counts only steps still on the path, and puts the boss next once a chapter's steps are done", () => {
    const states = stepStates(mission([["0:1"], ["1:0"]]), done("0:0", "0:1"));
    expect(states.doneOnPath).toBe(1);
    expect(states.current).toBeNull();
    expect(states.boss?.chapter.id).toBe("0");
    expect(states.bossState("0")).toBe("ready");
    expect(states.bossState("1")).toBe("upcoming");
    expect(states.state("1:0")).toBe("upcoming");
    expect(states.finished).toBe(false);
  });

  it("offers the test early while steps remain, and skips them once the chapter closes", () => {
    const early = stepStates(mission([["0:0", "0:1"], ["1:0"]]), done("0:0"));
    expect(early.bossState("0")).toBe("early");

    const closed = stepStates(
      mission([["0:0", "0:1"], ["1:0"]]),
      withEvents(["0:0"], [boss("0", "not-yet")]),
    );
    expect(closed.state("0:1")).toBe("skipped");
    expect(closed.bossState("0")).toBe("not-yet");
    expect(closed.current?.step.id).toBe("1:0");
  });

  it("finishes when every chapter is closed, and is beaten only when no test is not yet", () => {
    const notYet = stepStates(
      mission([["0:0"], ["1:0"]]),
      withEvents(["0:0", "1:0"], [boss("0", "not-yet"), boss("1", "done")]),
    );
    expect(notYet.finished).toBe(true);
    expect(notYet.allBeaten).toBe(false);

    const beaten = stepStates(
      mission([["0:0"], ["1:0"]]),
      withEvents(["0:0", "1:0"], [boss("0", "done"), boss("1", "done")]),
    );
    expect(beaten.allBeaten).toBe(true);
    expect(beaten.bossState("1")).toBe("done");
  });

  it("leads from a chapter's last step to its test, and from a closed chapter onward", () => {
    const plan = mission([["0:0", "0:1"], ["1:0"]]);
    const open = stepStates(plan, done("0:0", "0:1"));
    expect(nextAfterStep(plan, open, 0, 0)).toEqual({
      href: "/step?mission=m-1&step=0%3A1",
      label: "Next step",
    });
    expect(nextAfterStep(plan, open, 0, 1)).toEqual({
      href: "/boss?mission=m-1&chapter=0",
      label: "Take the test",
    });
    // A chapter not reached yet still ends in its test.
    expect(nextAfterStep(plan, open, 1, 0)).toEqual({
      href: "/boss?mission=m-1&chapter=1",
      label: "Take the test",
    });

    const closed = stepStates(plan, withEvents(["0:0", "0:1"], [boss("0", "done")]));
    expect(nextAfterStep(plan, closed, 0, 1)).toEqual({
      href: "/step?mission=m-1&step=1%3A0",
      label: "Next step",
    });
    const finished = stepStates(
      plan,
      withEvents(["0:0", "0:1", "1:0"], [boss("0", "done"), boss("1", "done")]),
    );
    expect(nextAfterStep(plan, finished, 1, 0)).toBeNull();
  });

  it("marks a chapter closed before boss fights as having no test", () => {
    const legacy = foldProgress([
      ...readEventsOf(["0:0"]),
      {
        version: 2,
        eventId: "c0",
        missionId: "m-1",
        recordedAt: "2026-11-12T00:00:00.000Z",
        type: "ChapterCompleted",
        chapterId: "0",
        xp: 100,
        calculatorVersion: "neutral-v1",
      },
    ]);
    const states = stepStates(mission([["0:0"], ["1:0"]]), legacy);
    expect(states.bossState("0")).toBe("legacy");
    expect(states.current?.step.id).toBe("1:0");
    expect(bossHref("m-1", "0")).toBe("/boss?mission=m-1&chapter=0");
  });

  it("shows no estimate for a step nobody estimated, and links by id", () => {
    expect(estimateLabel(0)).toBeNull();
    expect(estimateLabel(75)).toBe("About 1 h 15 min");
    expect(stepHref("m-1", "own-2")).toBe("/step?mission=m-1&step=own-2");
  });
});

describe("links to a step", () => {
  it("reads an old position link as the id of the step generated there", () => {
    expect(stepIdParam({ chapter: "0", step: "1" })).toBe("0:1");
  });

  it("reads an id link as the id", () => {
    expect(stepIdParam({ step: "own-2" })).toBe("own-2");
    expect(stepIdParam({ step: "1:0" })).toBe("1:0");
  });

  it("refuses malformed links", () => {
    expect(stepIdParam({})).toBeUndefined();
    expect(stepIdParam({ chapter: "x", step: "1" })).toBeUndefined();
    expect(stepIdParam({ step: "../etc" })).toBeUndefined();
    expect(stepIdParam({ step: ["a", "b"] })).toBeUndefined();
  });
});

describe("Today's logs", () => {
  const record = (missionId: string) => ({
    missionId,
    ownerId: "owner-1",
    runId: "run",
    generatedAt: "2026-11-12T00:00:00.000Z",
    goalText: "goal",
    pursuitSlug: "goal",
    safetyClass: "NORMAL" as const,
    mission: {
      title: missionId,
      goalType: "PROJECT" as const,
      primaryDomain: "Mind" as const,
      chapters: [],
    },
  });
  const log = {
    logId: "l-1",
    ownerId: "owner-1",
    missionId: "m-ok",
    chapterId: "0",
    kind: "note" as const,
    text: "ran",
    loggedAt: "2026-11-12T01:00:00.000Z",
  };

  it("gives a mission whose logs fail an empty list, and still loads Today", async () => {
    const records = [record("m-ok"), record("m-broken")];
    resolveRequestSession.mockResolvedValue({
      principal: { id: "owner-1", createdAt: "2026-11-12T00:00:00.000Z" },
      ports: {
        persistence: {
          record: async () => undefined,
          listForOwner: async () => records,
          findForOwner: async (_owner: string, id: string) =>
            records.find((entry) => entry.missionId === id) ?? null,
        },
        ledger: { read: async () => [] },
        logs: {
          list: async (_owner: string, missionId: string) => {
            if (missionId === "m-broken") throw new GenerationError("STORE_UNAVAILABLE");
            return [log];
          },
        },
      },
    });

    const loaded = await loadGuestMissions({ withLogs: true });
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.missions).toHaveLength(2);
    expect(loaded.logs["m-ok"]).toEqual([
      {
        logId: "l-1",
        missionId: "m-ok",
        chapterId: "0",
        kind: "note",
        text: "ran",
        loggedAt: "2026-11-12T01:00:00.000Z",
      },
    ]);
    expect(loaded.logs["m-broken"]).toEqual([]);
  });
});

describe("loading Today", () => {
  const OWNER = { id: "owner-1", createdAt: "2026-11-01T00:00:00.000Z" };

  async function sessionWithMission() {
    const store = await createDemoStore({ driver: "memory", retentionSeconds: 3600 });
    const ports = demoPortsFromStore(store);
    await ports.persistence.record({
      missionId: "m-1",
      ownerId: OWNER.id,
      runId: "run-1",
      generatedAt: "2026-11-01T00:00:00.000Z",
      goalText: "learn farsi",
      pursuitSlug: "learn-farsi",
      mission: upcastMission({
        title: "Conversational Farsi",
        goalType: "PROJECT",
        primaryDomain: "Mind",
        chapters: [
          {
            index: 0,
            title: "Sounds",
            exitCondition: "Read",
            steps: [
              {
                index: 0,
                title: "Step 1",
                estimatedMinutes: 20,
                verification: "SELF",
                guide: { approach: "", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
                sources: [],
                toolKinds: [],
              },
            ],
          },
        ],
      }),
      safetyClass: "NORMAL",
      // No goal context: no zone of its own.
    });
    return { principal: OWNER, ports };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the browser's zone from the cookie for a mission with none", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T13:30:00.000Z")); // 00:30 on the 13th in Sydney
    request.cookie = "other=1; zandegi_tz=Australia%2FSydney";
    resolveRequestSession.mockResolvedValue(await sessionWithMission());
    const loaded = await loadGuestMissions({ withToday: true });
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.plans["m-1"]?.today).toBe("2026-11-13");
  });

  it("stays ready with no reminder setting when reminders cannot be read", async () => {
    const session = await sessionWithMission();
    session.ports = {
      ...session.ports,
      reminders: {
        ...session.ports.reminders,
        find: async () => {
          throw new GenerationError("STORE_UNAVAILABLE");
        },
      },
    };
    resolveRequestSession.mockResolvedValue(session);
    const loaded = await loadGuestMissions({ withToday: true });
    expect(loaded).toMatchObject({ status: "ready", reminder: null });
    if (loaded.status !== "ready") return;
    expect(loaded.plans["m-1"]?.todayStepIds).toEqual(["0:0"]);
  });
});
