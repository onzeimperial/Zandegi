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

const { PATCH } = await import("./route");
const { GET: readMission } = await import("../route");

const ORIGIN = "http://localhost";

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "Done." },
  sources: [{ title: "A source", date: "2026-01-01" }],
  toolKinds: [],
});

/** A guest with one stored two-chapter mission, through the real use case. */
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
              { index: 0, title: "Sounds", exitCondition: "Read aloud", steps: [step(0), step(1)] },
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

function patch(
  missionId: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return PATCH(
    new Request(`${ORIGIN}/api/missions/${missionId}/plan`, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    }),
    { params: Promise.resolve({ id: missionId }) },
  );
}

async function read(missionId: string, cookie: string) {
  const response = await readMission(
    new Request(`${ORIGIN}/api/missions/${missionId}`, { headers: { cookie } }),
    { params: Promise.resolve({ id: missionId }) },
  );
  return ((await response.json()) as { mission: { version: number; mission: unknown } }).mission;
}

async function code(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

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

describe("PATCH /api/missions/[id]/plan", () => {
  it("saves an edit for the owner and answers the mission at its new version", async () => {
    const { missionId, cookie } = await seedMission();
    const response = await patch(
      missionId,
      { version: 0, edit: { op: "editStep", stepId: "0:1", title: "Practise the letters" } },
      { cookie },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { mission } = (await response.json()) as {
      mission: { version: number; mission: { chapters: { steps: unknown[] }[] } };
    };
    expect(mission.version).toBe(1);
    expect(mission.mission.chapters[0]!.steps[1]).toMatchObject({
      id: "0:1",
      title: "Practise the letters",
      writtenBy: "person",
      sources: [],
    });
    expect(await read(missionId, cookie)).toMatchObject({ version: 1 });
  });

  it("refuses a stale version with 409 and saves nothing", async () => {
    const { missionId, cookie } = await seedMission();
    const rename = (title: string) => ({
      version: 0,
      edit: { op: "renameChapter", chapterId: "0", title },
    });
    expect((await patch(missionId, rename("First"), { cookie })).status).toBe(200);
    const stale = await patch(missionId, rename("Stale"), { cookie });
    expect(stale.status).toBe(409);
    expect(await code(stale)).toBe("PLAN_EDIT_CONFLICT");
    expect(await read(missionId, cookie)).toMatchObject({
      version: 1,
      mission: { chapters: [{ title: "First" }, { title: "Words" }] },
    });
  });

  it("refuses to add or remove a chapter with 400", async () => {
    const { missionId, cookie } = await seedMission();
    for (const edit of [
      { op: "addChapter", title: "Extra" },
      { op: "deleteChapter", chapterId: "1" },
    ]) {
      const response = await patch(missionId, { version: 0, edit }, { cookie });
      expect(response.status).toBe(400);
      expect(await code(response)).toBe("INVALID_REQUEST");
    }
    expect(await read(missionId, cookie)).toMatchObject({ version: 0 });
  });

  it("answers another guest's mission, and no cookie, exactly as a missing one", async () => {
    const { missionId, cookie } = await seedMission();
    const intruder = await seedMission();
    const body = { version: 0, edit: { op: "deleteStep", stepId: "0:0" } };
    expect((await patch(missionId, body, { cookie: intruder.cookie })).status).toBe(404);
    expect((await patch(missionId, body)).status).toBe(404);
    expect(await read(missionId, cookie)).toMatchObject({ version: 0 });
  });

  it("refuses a cross-site request, a non-JSON body and malformed JSON", async () => {
    const { missionId, cookie } = await seedMission();
    const body = { version: 0, edit: { op: "deleteStep", stepId: "0:0" } };
    const crossSite = await patch(missionId, body, { cookie, origin: "https://evil.example" });
    expect(crossSite.status).toBe(403);
    expect(await code(crossSite)).toBe("CROSS_SITE_REQUEST");
    expect((await patch(missionId, body, { cookie, "content-type": "text/plain" })).status).toBe(
      415,
    );
    expect((await patch(missionId, "{not json", { cookie })).status).toBe(400);
    expect((await patch(missionId, { title: "x".repeat(20_000) }, { cookie })).status).toBe(413);
    expect(await read(missionId, cookie)).toMatchObject({ version: 0 });
  });

  it("is off in production without Clerk", async () => {
    const { missionId, cookie } = await seedMission();
    vi.stubEnv("NODE_ENV", "production");
    const body = { version: 0, edit: { op: "deleteStep", stepId: "0:0" } };
    expect((await patch(missionId, body, { cookie })).status).toBe(503);
  });
});
