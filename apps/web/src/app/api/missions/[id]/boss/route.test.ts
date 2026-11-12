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

const { POST } = await import("./route");
const { POST: complete } = await import("../complete/route");

const ORIGIN = "http://localhost";
/** The leading bytes of a real JPEG; enough for the sniffer. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PRIVATE = "my knees hurt on the hills";

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "Done." },
  sources: [],
  toolKinds: [],
});

/** A guest with a stored two-chapter mission, through the real use case. */
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
    { request: { rawText: "run a half marathon" }, principal: guest.principal },
    {
      clock: systemClock,
      ids: randomIdGenerator,
      cancellation: cancellationFrom(new AbortController().signal),
      knowledge: emptyKnowledge,
      persistence: ports.persistence,
      draftGenerator: async () => ({
        draft: {
          goalText: "run a half marathon",
          pursuitSlug: "run-a-half-marathon",
          mission: {
            title: "Half Marathon",
            goalType: "PROJECT",
            primaryDomain: "Body",
            chapters: [
              { index: 0, title: "Base", exitCondition: "Run 5km", steps: [step(0), step(1)] },
              { index: 1, title: "Build", exitCondition: "Run 10km", steps: [step(0)] },
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

function form(fields: Record<string, string | Blob>): FormData {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  return body;
}

async function send(
  handler: typeof POST,
  path: string,
  missionId: string,
  body: FormData,
  headers: Record<string, string>,
): Promise<Response> {
  const encoded = new Response(body);
  const bytes = await encoded.arrayBuffer();
  return handler(
    new Request(`${ORIGIN}/api/missions/${missionId}/${path}`, {
      method: "POST",
      body: bytes,
      headers: {
        "content-type": encoded.headers.get("content-type")!,
        "content-length": String(bytes.byteLength),
        origin: ORIGIN,
        ...headers,
      },
    }),
    { params: Promise.resolve({ id: missionId }) },
  );
}

let keys = 0;
const attempt = (missionId: string, fields: Record<string, string | Blob>, headers = {}) =>
  send(
    POST,
    "boss",
    missionId,
    form({
      chapterId: "0",
      result: "done",
      evidence: "SELF",
      attemptKey: `route-key-${++keys}`,
      didntGoWell: PRIVATE,
      ...fields,
    }),
    headers,
  );

async function finishChapterSteps(missionId: string, cookie: string) {
  for (const stepId of ["0:0", "0:1"]) {
    const response = await send(
      complete,
      "complete",
      missionId,
      form({ stepId, evidence: "SELF" }),
      {
        cookie,
      },
    );
    expect(response.status).toBe(200);
  }
}

async function body(response: Response) {
  return (await response.json()) as {
    result?: {
      attemptId: string | null;
      awards: { kind: string; xp: number }[];
      improveStep: { chapterId: string; stepId: string } | null;
      progress: { totalXp: number; completedChapters: unknown[] };
    };
    error?: { code: string };
  };
}

beforeEach(() => {
  resetDemoPortsCache();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  vi.stubEnv("ZANDEGI_DAILY_GENERATION_LIMIT", "");
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

describe("POST /api/missions/[id]/boss", () => {
  it("records a done attempt with a photo, pays 450 and carries the improve step over", async () => {
    const { missionId, cookie } = await seedMission();
    await finishChapterSteps(missionId, cookie);
    const response = await attempt(
      missionId,
      { evidence: "ARTIFACT", photo: new Blob([JPEG]), improve: "Start slower" },
      { cookie },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { result } = await body(response);
    expect(result!.awards).toEqual([{ kind: "boss", xp: 450 }]);
    expect(result!.improveStep).toEqual({ chapterId: "1", stepId: "own-1" });
    expect(result!.progress.totalXp).toBe(80 + 450);
  });

  it("closes the chapter at 0 for not yet, then pays a try-again done once", async () => {
    const { missionId, cookie } = await seedMission();
    await finishChapterSteps(missionId, cookie);
    const notYet = await body(await attempt(missionId, { result: "not-yet" }, { cookie }));
    expect(notYet.result!.awards).toEqual([]);
    expect(notYet.result!.progress.completedChapters).toHaveLength(1);

    const retry = await body(await attempt(missionId, {}, { cookie }));
    expect(retry.result!.awards).toEqual([{ kind: "boss", xp: 400 }]);
    const again = await body(await attempt(missionId, {}, { cookie }));
    expect(again.result!.awards).toEqual([]);
    expect(again.result!.progress.totalXp).toBe(480);
  });

  it("treats a double submit as one attempt", async () => {
    const { missionId, cookie } = await seedMission();
    await finishChapterSteps(missionId, cookie);
    const fields = { attemptKey: "same-route-key" };
    const [first, second] = await Promise.all([
      attempt(missionId, fields, { cookie }),
      attempt(missionId, fields, { cookie }),
    ]);
    const results = [(await body(first)).result!, (await body(second)).result!];
    expect(results.flatMap((result) => result.awards)).toEqual([{ kind: "boss", xp: 400 }]);
    expect(results.filter((result) => result.attemptId !== null)).toHaveLength(1);
  });

  it("refuses an attempt before the steps are done with 409 BOSS_NOT_READY, unless skipped", async () => {
    const { missionId, cookie } = await seedMission();
    const early = await attempt(missionId, {}, { cookie });
    expect(early.status).toBe(409);
    expect((await body(early)).error!.code).toBe("BOSS_NOT_READY");

    const skipped = await attempt(missionId, { skipRest: "true" }, { cookie });
    expect(skipped.status).toBe(200);
    expect((await body(skipped)).result!.awards).toEqual([{ kind: "boss", xp: 400 }]);
  });

  it("refuses an empty debrief, an unknown field and boss evidence it does not accept", async () => {
    const { missionId, cookie } = await seedMission();
    await finishChapterSteps(missionId, cookie);
    for (const fields of [
      { didntGoWell: "" },
      { xp: "400" },
      { evidence: "METRIC" },
      { evidence: "ARTIFACT" },
      { skipRest: "yes" },
    ]) {
      const response = await attempt(missionId, fields, { cookie });
      expect(response.status).toBe(400);
      expect((await body(response)).error!.code).toBe("INVALID_REQUEST");
    }
  });

  it("never logs the debrief", async () => {
    const { missionId, cookie } = await seedMission();
    // A refused attempt is the path that writes a diagnostic.
    expect((await attempt(missionId, {}, { cookie })).status).toBe(409);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(PRIVATE);
  });

  it("answers another guest's mission and no cookie exactly as a missing one", async () => {
    const { missionId, cookie } = await seedMission();
    await finishChapterSteps(missionId, cookie);
    const intruder = await seedMission();
    expect((await attempt(missionId, {}, { cookie: intruder.cookie })).status).toBe(404);
    expect((await attempt(missionId, {})).status).toBe(404);
    // Nothing was recorded for the owner either.
    const owned = await body(await attempt(missionId, {}, { cookie }));
    expect(owned.result!.awards).toEqual([{ kind: "boss", xp: 400 }]);
  });

  it("refuses a cross-site request, a non-form body, and is off in production without Clerk", async () => {
    const { missionId, cookie } = await seedMission();
    const crossSite = await attempt(missionId, {}, { cookie, origin: "https://evil.example" });
    expect(crossSite.status).toBe(403);
    expect((await body(crossSite)).error!.code).toBe("CROSS_SITE_REQUEST");

    const json = await POST(
      new Request(`${ORIGIN}/api/missions/${missionId}/boss`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json", origin: ORIGIN, cookie },
      }),
      { params: Promise.resolve({ id: missionId }) },
    );
    expect(json.status).toBe(415);

    vi.stubEnv("NODE_ENV", "production");
    expect((await attempt(missionId, {}, { cookie })).status).toBe(503);
  });
});
