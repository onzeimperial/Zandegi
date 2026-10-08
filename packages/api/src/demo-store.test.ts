import { StoreUnavailableError, createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it } from "vitest";
import type { GenerationSafetyClass, MissionDraft } from "./client";
import {
  createDemoStore,
  demoPortsFromStore,
  demoStoreConfigFromEnv,
  guestCookiePolicyFromEnv,
  guestRetentionSecondsFromEnv,
  type Env,
  type StoredDemoStore,
} from "./demo-store";
import { GenerationError } from "./errors";
import { resolveOrMintGuest } from "./identity/guest";
import { randomTokenSource, sha256TokenHasher } from "./identity/ports";
import { readGuestToken } from "./identity/cookie";
import { fixedClock, sequentialIdGenerator } from "./ports";
import { generateMission } from "./generation/generate-mission";
import { emptyKnowledge, cancellationFrom } from "./ports";
import { readMission } from "./missions/read-mission";

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const NOW = new Date("2026-10-07T00:00:00.000Z");

const REDIS_ENV: Env = {
  UPSTASH_REDIS_REST_URL: "https://demo.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "a-token",
};

describe("retention configuration", () => {
  it("defaults to the demo's 30 days", () => {
    expect(guestRetentionSecondsFromEnv({})).toBe(THIRTY_DAYS);
    expect(guestRetentionSecondsFromEnv({ ZANDEGI_GUEST_RETENTION_DAYS: "" })).toBe(THIRTY_DAYS);
  });

  it("is configuration, not a constant", () => {
    expect(guestRetentionSecondsFromEnv({ ZANDEGI_GUEST_RETENTION_DAYS: "7" })).toBe(
      7 * 24 * 60 * 60,
    );
  });

  it("clamps a value that would produce no window or an absurd one", () => {
    expect(guestRetentionSecondsFromEnv({ ZANDEGI_GUEST_RETENTION_DAYS: "0" })).toBe(THIRTY_DAYS);
    expect(guestRetentionSecondsFromEnv({ ZANDEGI_GUEST_RETENTION_DAYS: "-3" })).toBe(THIRTY_DAYS);
    expect(guestRetentionSecondsFromEnv({ ZANDEGI_GUEST_RETENTION_DAYS: "nope" })).toBe(
      THIRTY_DAYS,
    );
    expect(guestRetentionSecondsFromEnv({ ZANDEGI_GUEST_RETENTION_DAYS: "99999" })).toBe(
      365 * 24 * 60 * 60,
    );
  });

  it("keeps Secure on everywhere but local development", () => {
    expect(guestCookiePolicyFromEnv({ NODE_ENV: "development" }).secure).toBe(false);
    expect(guestCookiePolicyFromEnv({ NODE_ENV: "production" }).secure).toBe(true);
    expect(guestCookiePolicyFromEnv({}).secure).toBe(true);
  });
});

describe("store selection", () => {
  it("defaults to the in-memory twin, so tests and local work need no credentials", () => {
    expect(demoStoreConfigFromEnv({})).toEqual({ driver: "memory", retentionSeconds: THIRTY_DAYS });
  });

  it("infers Redis once Upstash is configured", () => {
    expect(demoStoreConfigFromEnv(REDIS_ENV)).toEqual({
      driver: "redis",
      retentionSeconds: THIRTY_DAYS,
      redis: { url: "https://demo.upstash.io", token: "a-token" },
    });
  });

  it("lets configuration override the inference in both directions", () => {
    expect(demoStoreConfigFromEnv({ ...REDIS_ENV, ZANDEGI_MISSION_STORE: "memory" }).driver).toBe(
      "memory",
    );
    expect(demoStoreConfigFromEnv({ ...REDIS_ENV, ZANDEGI_MISSION_STORE: "REDIS" }).driver).toBe(
      "redis",
    );
  });

  it("fails closed rather than silently downgrading to a forgetful store", () => {
    const error = (() => {
      try {
        demoStoreConfigFromEnv({ ZANDEGI_MISSION_STORE: "redis" });
        return null;
      } catch (caught) {
        return caught as GenerationError;
      }
    })();

    expect(error).toBeInstanceOf(GenerationError);
    expect(error!.code).toBe("STORE_UNAVAILABLE");
    expect(error!.diagnostic).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("builds the in-memory store without touching a network", async () => {
    const store = await createDemoStore({ driver: "memory", retentionSeconds: 60 });
    await store.recordMission({
      missionId: "m-1",
      ownerId: "guest-1",
      runId: "run-1",
      generatedAt: NOW.toISOString(),
      goalText: "learn farsi",
      pursuitSlug: "learn-farsi",
      mission: { title: "t", goalType: "HABIT", primaryDomain: "Mind", chapters: [] },
      safetyClass: "NORMAL",
    });
    await expect(store.findMission("guest-1", "m-1")).resolves.toMatchObject({ missionId: "m-1" });
  });
});

describe("the port adapter", () => {
  it("turns a store failure into the stable code, carrying no credential", async () => {
    const broken: StoredDemoStore = {
      recordMission: async () => {
        throw new StoreUnavailableError("recordMission", "[redacted]: connection refused");
      },
      findMission: async () => {
        throw new StoreUnavailableError("findMission", "[redacted]: connection refused");
      },
      listMissions: async () => {
        throw new StoreUnavailableError("listMissions", "[redacted]: connection refused");
      },
      findGuest: async () => {
        throw new Error("fetch failed for https://demo.upstash.io with token a-token");
      },
      saveGuest: async () => undefined,
      renewGuest: async () => undefined,
    };
    const ports = demoPortsFromStore(broken);

    const read = await ports.persistence.findForOwner("guest-1", "m-1").then(
      () => null,
      (error: unknown) => error as GenerationError,
    );
    expect(read!.code).toBe("STORE_UNAVAILABLE");
    expect(read!.message).toBe("Your missions are temporarily unavailable. Try again.");

    // An unsanitised throw from below is replaced wholesale rather than
    // forwarded, so a provider message cannot smuggle an endpoint into a log.
    const guest = await ports.guests.findByTokenHash("abc").then(
      () => null,
      (error: unknown) => error as GenerationError,
    );
    expect(guest!.code).toBe("STORE_UNAVAILABLE");
    expect(guest!.diagnostic).not.toContain("upstash.io");
    expect(guest!.diagnostic).not.toContain("a-token");
  });
});

describe("generate then read, against the twin", () => {
  it("stores the mission against the minted principal and reads it back", async () => {
    const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass>({
      retentionSeconds: THIRTY_DAYS,
    });
    const ports = demoPortsFromStore(store);
    const identity = {
      clock: fixedClock(NOW),
      ids: sequentialIdGenerator("guest"),
      tokens: randomTokenSource,
      hasher: sha256TokenHasher,
      guests: ports.guests,
    };

    const visitor = await resolveOrMintGuest(null, guestCookiePolicyFromEnv({}), identity);
    expect(visitor.minted).toBe(true);
    expect(readGuestToken(visitor.setCookie.split(";", 1)[0]!)).not.toBeNull();

    const result = await generateMission(
      { request: { rawText: "learn farsi" }, principal: visitor.principal },
      {
        clock: fixedClock(NOW),
        ids: sequentialIdGenerator("id"),
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

    if (result.outcome !== "mission") throw new Error("unreachable");

    const view = await readMission(
      { principal: visitor.principal, missionId: result.missionId },
      { persistence: ports.persistence },
    );
    expect(view.missionId).toBe(result.missionId);
    expect(view.mission.title).toBe("Conversational Farsi");

    // A second visitor gets their own principal and cannot see the first one's
    // mission: not-found, not forbidden.
    const other = await resolveOrMintGuest(null, guestCookiePolicyFromEnv({}), identity);
    expect(other.principal.id).not.toBe(visitor.principal.id);
    await expect(
      readMission(
        { principal: other.principal, missionId: result.missionId },
        { persistence: ports.persistence },
      ),
    ).rejects.toMatchObject({ code: "MISSION_NOT_FOUND" });
  });
});
