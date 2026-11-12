import { GenerationError, foldProgress } from "@zandegi/api";
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

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (target: string) => redirect(target) }));
vi.mock("./session", async () => {
  const actual = await vi.importActual<typeof import("./session")>("./session");
  return { ...actual, resolveRequestSession: () => resolveRequestSession() };
});

const { loadGuestMissions, stepStates, estimateLabel, stepHref, stepIdParam } =
  await import("./guest-missions");
const { default: GenerateLayout } = await import("@/app/generate/layout");

beforeEach(() => {
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

  it("counts only steps still on the path, and finishes when they are all done", () => {
    const states = stepStates(mission([["0:1"], ["1:0"]]), done("0:0", "0:1", "1:0"));
    expect(states.doneOnPath).toBe(2);
    expect(states.finished).toBe(true);
    expect(states.current).toBeNull();
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
