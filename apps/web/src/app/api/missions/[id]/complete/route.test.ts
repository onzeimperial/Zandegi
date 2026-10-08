import {
  cancellationFrom,
  demoPortsFromEnv,
  emptyKnowledge,
  generateMission,
  guestCookiePolicyFromEnv,
  randomIdGenerator,
  randomTokenSource,
  resolveOrMintGuest,
  sha256TokenHasher,
  systemClock,
} from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { POST } = await import("./route");

const ORIGIN = "http://localhost";
/** The leading bytes of a real JPEG; enough for the sniffer. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "Done." },
  sources: [],
  toolKinds: [],
});

/**
 * Mint a guest and store a one-chapter, two-step mission through the real use
 * case, with the content pipeline stubbed. The route under test reads from the
 * same store, so this is end to end with no network and no model call.
 */
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
              {
                index: 0,
                title: "Sounds and script",
                exitCondition: "Read the alphabet aloud",
                steps: [step(0), step(1)],
              },
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

async function post(
  missionId: string,
  body: FormData,
  headers: Record<string, string> = {},
): Promise<Response> {
  // Serialise once so the request carries a real Content-Length, as a
  // browser's form upload does.
  const encoded = new Response(body);
  const bytes = await encoded.arrayBuffer();
  return POST(
    new Request(`${ORIGIN}/api/missions/${missionId}/complete`, {
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

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ENABLE_UNAUTHENTICATED_GENERATION", "");
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

describe("POST /api/missions/[id]/complete", () => {
  it("confirms the owner's current step with a check and pays 40 XP", async () => {
    const { missionId, cookie } = await seedMission();
    const response = await post(missionId, form({ chapter: "0", step: "0", evidence: "SELF" }), {
      cookie,
    });

    expect(response.status).toBe(200);
    const { result } = (await response.json()) as {
      result: { awards: unknown[]; progress: { totalXp: number } };
    };
    expect(result.awards).toEqual([{ kind: "step", xp: 40 }]);
    expect(result.progress.totalXp).toBe(40);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("confirms with a photo for 50 XP", async () => {
    const { missionId, cookie } = await seedMission();
    const response = await post(
      missionId,
      form({ chapter: "0", step: "0", evidence: "ARTIFACT", photo: new Blob([JPEG]) }),
      { cookie },
    );
    const { result } = (await response.json()) as { result: { awards: unknown[] } };
    expect(result.awards).toEqual([{ kind: "step", xp: 50 }]);
  });

  it("rejects a cross-site request before it reads the body or touches the store", async () => {
    const { missionId, cookie } = await seedMission();
    const response = await post(missionId, form({ chapter: "0", step: "0", evidence: "SELF" }), {
      cookie,
      origin: "https://evil.example",
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "CROSS_SITE_REQUEST",
    );
  });

  it("answers a caller with no cookie exactly as a missing mission", async () => {
    const { missionId } = await seedMission();
    const response = await post(missionId, form({ chapter: "0", step: "0", evidence: "SELF" }));
    expect(response.status).toBe(404);
  });

  it("answers another guest's mission exactly as a missing one", async () => {
    const { missionId } = await seedMission();
    const intruder = await seedMission();
    const response = await post(missionId, form({ chapter: "0", step: "0", evidence: "SELF" }), {
      cookie: intruder.cookie,
    });
    expect(response.status).toBe(404);
  });

  it("refuses to skip ahead", async () => {
    const { missionId, cookie } = await seedMission();
    const response = await post(missionId, form({ chapter: "0", step: "1", evidence: "SELF" }), {
      cookie,
    });
    expect(response.status).toBe(409);
  });

  it("rejects a file that is not a photo, naming no internal detail", async () => {
    const { missionId, cookie } = await seedMission();
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>']);
    const response = await post(
      missionId,
      form({ chapter: "0", step: "0", evidence: "ARTIFACT", photo: svg }),
      { cookie },
    );
    expect(response.status).toBe(422);
    const { error } = (await response.json()) as { error: Record<string, unknown> };
    expect(Object.keys(error).sort()).toEqual(["code", "message", "requestId"]);
  });

  it("rejects a body that is not a form, and one with no declared length", async () => {
    const { missionId, cookie } = await seedMission();
    const json = await POST(
      new Request(`${ORIGIN}/api/missions/${missionId}/complete`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json", origin: ORIGIN, cookie },
      }),
      { params: Promise.resolve({ id: missionId }) },
    );
    expect(json.status).toBe(415);

    const unsized = await POST(
      new Request(`${ORIGIN}/api/missions/${missionId}/complete`, {
        method: "POST",
        body: "x",
        headers: { "content-type": "multipart/form-data; boundary=x", origin: ORIGIN, cookie },
      }),
      { params: Promise.resolve({ id: missionId }) },
    );
    expect(unsized.status).toBe(400);
  });

  it("is off in production unless explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { missionId, cookie } = await seedMission();
    const response = await post(missionId, form({ chapter: "0", step: "0", evidence: "SELF" }), {
      cookie,
    });
    expect(response.status).toBe(503);
  });
});
