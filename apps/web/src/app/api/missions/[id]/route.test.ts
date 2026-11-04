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

const { GET } = await import("./route");

function readRequest(id: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/missions/${id}`, { headers });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Mint a guest and store one mission for them through the real use case, with
 * the content pipeline replaced by a stub.
 *
 * The route under test resolves its own ports from the same environment, so it
 * reads back out of the very store this writes into — no network, no model
 * call, and no Upstash credentials anywhere.
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
                steps: [],
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

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  vi.stubEnv("ZANDEGI_DAILY_GENERATION_LIMIT", "");
  // No Upstash credentials: the route must work against the in-memory twin.
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("ZANDEGI_MISSION_STORE", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/missions/[id]", () => {
  it("returns the caller's own mission and renews the cookie", async () => {
    const { missionId, cookie } = await seedMission();

    const response = await GET(readRequest(missionId, { Cookie: cookie }), context(missionId));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");

    const body = (await response.json()) as {
      mission: { missionId: string; pursuitSlug: string; mission: { title: string } };
    };
    expect(body.mission.missionId).toBe(missionId);
    expect(body.mission.mission.title).toBe("Conversational Farsi");
    // Server-side record fields stay server-side.
    for (const field of ["ownerId", "runId", "goalText"]) {
      expect(Object.keys(body.mission), field).not.toContain(field);
    }
  });

  it("answers not-found for another principal, no cookie, a tampered cookie and an unknown id", async () => {
    const first = await seedMission();
    const second = await seedMission();
    expect(second.cookie).not.toBe(first.cookie);

    const cases: [string, Request, string][] = [
      [
        "another principal's mission",
        readRequest(first.missionId, { Cookie: second.cookie }),
        first.missionId,
      ],
      ["no cookie at all", readRequest(first.missionId), first.missionId],
      [
        "a tampered cookie",
        readRequest(first.missionId, { Cookie: "zandegi_guest=nope" }),
        first.missionId,
      ],
      [
        "an id that was never issued",
        readRequest("mission-404", { Cookie: first.cookie }),
        "mission-404",
      ],
    ];

    for (const [label, request, id] of cases) {
      const response = await GET(request, context(id));
      // Identical in every case. A 403 would confirm the mission exists.
      expect(response.status, label).toBe(404);
      expect(await response.json(), label).toMatchObject({
        error: { code: "MISSION_NOT_FOUND", message: "That mission is not available." },
      });
    }
  });

  it("is disabled by default in production, like the generate route", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(readRequest("m-1"), context("m-1"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "GENERATION_DISABLED" } });
  });

  it("fails closed with a safe error when the configured store cannot be reached", async () => {
    vi.stubEnv("ZANDEGI_MISSION_STORE", "redis");
    const response = await GET(readRequest("m-1"), context("m-1"));

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("STORE_UNAVAILABLE");
    expect(text.toLowerCase()).not.toContain("upstash");
  });
});
