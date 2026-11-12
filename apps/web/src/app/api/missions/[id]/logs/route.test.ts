import {
  cancellationFrom,
  demoPortsFromEnv,
  emptyKnowledge,
  generateMission,
  guestCookiePolicyFromEnv,
  randomIdGenerator,
  randomTokenSource,
  resetDemoPortsCache,
  resolveOrMintGuest,
  sha256TokenHasher,
  systemClock,
} from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { GET, POST } = await import("./route");
const { PATCH } = await import("./[logId]/route");

const ORIGIN = "http://localhost";
const NOTE = "Learned five letters on the train";

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "Done." },
  sources: [],
  toolKinds: [],
});

async function seedMission(): Promise<{ missionId: string; cookie: string }> {
  const ports = await demoPortsFromEnv();
  const guest = await resolveOrMintGuest(null, guestCookiePolicyFromEnv(process.env), {
    clock: systemClock,
    ids: randomIdGenerator,
    tokens: randomTokenSource,
    hasher: sha256TokenHasher,
    guests: ports.guests,
  });
  const result = await generateMission(
    { request: { rawText: "learn farsi" }, principal: guest.principal },
    {
      clock: systemClock,
      ids: randomIdGenerator,
      cancellation: cancellationFrom(new AbortController().signal),
      knowledge: emptyKnowledge,
      persistence: ports.persistence,
      draftGenerator: async () => ({
        draft: {
          goalText: "learn farsi",
          pursuitSlug: "learn-farsi",
          mission: {
            title: "Conversational Farsi",
            goalType: "PROJECT",
            primaryDomain: "Mind",
            chapters: [
              { index: 0, title: "Sounds", exitCondition: "Read aloud", steps: [step(0)] },
              { index: 1, title: "Words", exitCondition: "100 words", steps: [step(0)] },
            ],
          },
          grounding: { claimsChecked: 0, ungroundedClaims: [], rewritten: 0, dropped: 0 },
          safety: {
            safetyClass: "NORMAL",
            blocked: false,
            professionalFrameApplied: false,
            redactions: [],
          },
          modelsUsed: { interpret: "test-model" },
        },
      }),
    },
  );
  if (result.outcome !== "mission") throw new Error("the stub pipeline must produce a mission");
  return { missionId: result.missionId, cookie: guest.setCookie.split(";", 1)[0]! };
}

const jsonInit = (method: string, body: unknown, headers: Record<string, string>) => ({
  method,
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
});

function post(missionId: string, body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(`${ORIGIN}/api/missions/${missionId}/logs`, jsonInit("POST", body, headers)),
    {
      params: Promise.resolve({ id: missionId }),
    },
  );
}

function list(missionId: string, headers: Record<string, string> = {}) {
  return GET(new Request(`${ORIGIN}/api/missions/${missionId}/logs`, { headers }), {
    params: Promise.resolve({ id: missionId }),
  });
}

function move(
  missionId: string,
  logId: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return PATCH(
    new Request(
      `${ORIGIN}/api/missions/${missionId}/logs/${logId}`,
      jsonInit("PATCH", body, headers),
    ),
    { params: Promise.resolve({ id: missionId, logId }) },
  );
}

type LogBody = { log: { logId: string; chapterId: string; text?: string } };

beforeEach(() => {
  resetDemoPortsCache();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("ZANDEGI_MISSION_STORE", "");
  vi.stubEnv("ZANDEGI_ALLOWED_ORIGINS", "");
  vi.stubEnv("VERCEL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/missions/[id]/logs", () => {
  it("files a note under the current chapter, lists it, and moves it", async () => {
    const { missionId, cookie } = await seedMission();
    const saved = await post(missionId, { kind: "note", text: NOTE }, { cookie });
    expect(saved.status).toBe(200);
    const { log } = (await saved.json()) as LogBody;
    expect(log).toMatchObject({ chapterId: "0", kind: "note", text: NOTE });

    const listed = await list(missionId, { cookie });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ logs: [{ logId: log.logId, text: NOTE }] });

    const moved = await move(missionId, log.logId, { chapterId: "1" }, { cookie });
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as LogBody).log.chapterId).toBe("1");
  });

  it("files a number with a unit", async () => {
    const { missionId, cookie } = await seedMission();
    const saved = await post(missionId, { kind: "number", value: 5, unit: "km" }, { cookie });
    expect(await saved.json()).toMatchObject({ log: { kind: "number", value: 5, unit: "km" } });
  });

  it("answers another guest's mission, and no cookie, exactly as a missing one", async () => {
    const { missionId, cookie } = await seedMission();
    const intruder = await seedMission();
    const { log } = (await (
      await post(missionId, { kind: "note", text: NOTE }, { cookie })
    ).json()) as LogBody;

    expect(
      (await post(missionId, { kind: "note", text: "x" }, { cookie: intruder.cookie })).status,
    ).toBe(404);
    expect((await list(missionId, { cookie: intruder.cookie })).status).toBe(404);
    expect(
      (await move(missionId, log.logId, { chapterId: "1" }, { cookie: intruder.cookie })).status,
    ).toBe(404);
    expect((await post(missionId, { kind: "note", text: "x" })).status).toBe(404);
    // Nothing the intruder sent was saved or revealed.
    const body = JSON.stringify(
      await (await list(intruder.missionId, { cookie: intruder.cookie })).json(),
    );
    expect(body).not.toContain(NOTE);
  });

  it("refuses a bad log, a cross-site write, and a move to a chapter not in the mission", async () => {
    const { missionId, cookie } = await seedMission();
    expect((await post(missionId, { kind: "photo" }, { cookie })).status).toBe(400);
    expect((await post(missionId, { kind: "note", text: "x", xp: 50 }, { cookie })).status).toBe(
      400,
    );
    expect(
      (
        await post(
          missionId,
          { kind: "note", text: NOTE },
          { cookie, origin: "https://evil.example" },
        )
      ).status,
    ).toBe(403);
    const { log } = (await (
      await post(missionId, { kind: "note", text: NOTE }, { cookie })
    ).json()) as LogBody;
    expect((await move(missionId, log.logId, { chapterId: "9" }, { cookie })).status).toBe(400);
  });

  it("keeps the log text out of the server log", async () => {
    const { missionId, cookie } = await seedMission();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await post(missionId, { kind: "note", text: `${NOTE}\nsecond line` }, { cookie });
    expect(JSON.stringify(errors.mock.calls)).not.toContain(NOTE);
  });
});
