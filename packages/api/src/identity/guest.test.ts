import { createInMemoryDemoStore } from "@zandegi/db";
import type { GenerationSafetyClass, MissionDraft } from "../client";
import type { MissionGoalContext } from "../ports";
import { describe, expect, it } from "vitest";
import { demoPortsFromStore } from "../demo-store";
import { fixedClock, sequentialIdGenerator } from "../ports";
import { GUEST_COOKIE_NAME, readGuestToken, type GuestCookiePolicy } from "./cookie";
import { resolveGuest, resolveOrMintGuest, type GuestIdentityPorts } from "./guest";
import { fixedTokenSource, randomTokenSource, sha256TokenHasher } from "./ports";

const NOW = new Date("2026-10-07T00:00:00.000Z");
const POLICY: GuestCookiePolicy = { retentionSeconds: 30 * 24 * 60 * 60, secure: true };

interface Harness {
  ports: GuestIdentityPorts;
  store: ReturnType<
    typeof createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>
  >;
  now: () => number;
}

function harness(options: { tokens?: readonly string[]; now?: () => number } = {}): Harness {
  const now = options.now ?? (() => NOW.getTime());
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>({
    retentionSeconds: POLICY.retentionSeconds,
    now,
  });
  return {
    store,
    now,
    ports: {
      clock: fixedClock(NOW),
      ids: sequentialIdGenerator("guest"),
      tokens:
        options.tokens === undefined ? randomTokenSource : fixedTokenSource(...options.tokens),
      hasher: sha256TokenHasher,
      guests: demoPortsFromStore(store).guests,
    },
  };
}

function cookieHeader(setCookie: string): string {
  return setCookie.split(";", 1)[0]!;
}

describe("guest identity", () => {
  it("mints a principal and a cookie on a first visit, storing only the hash", async () => {
    const { ports, store } = harness();

    const session = await resolveOrMintGuest(null, POLICY, ports);

    expect(session.minted).toBe(true);
    expect(session.principal).toEqual({ id: "guest-1", createdAt: NOW.toISOString() });
    expect(session.setCookie).toContain("HttpOnly");

    const token = readGuestToken(cookieHeader(session.setCookie));
    expect(token).not.toBeNull();

    // The token is nowhere in the store. Only its SHA-256 is, and that is the
    // key the lookup uses.
    const tokenHash = await sha256TokenHasher.hash(token!);
    await expect(store.findGuest(tokenHash)).resolves.toEqual(session.principal);
    // The token itself is not a key and resolves to nothing.
    await expect(store.findGuest(token!)).resolves.toBeNull();
    expect(tokenHash).not.toContain(token!);
  });

  it("resolves the same principal on a return visit and renews the window", async () => {
    let clock = NOW.getTime();
    const { ports } = harness({ now: () => clock });

    const first = await resolveOrMintGuest(null, POLICY, ports);
    const header = cookieHeader(first.setCookie);

    // Most of the window passes, then the guest comes back.
    clock += 29 * 24 * 60 * 60 * 1000;
    const second = await resolveOrMintGuest(header, POLICY, ports);
    expect(second.minted).toBe(false);
    expect(second.principal.id).toBe(first.principal.id);

    // Without the renewal this next hop would be past the original window.
    clock += 29 * 24 * 60 * 60 * 1000;
    const third = await resolveOrMintGuest(cookieHeader(second.setCookie), POLICY, ports);
    expect(third.minted).toBe(false);
    expect(third.principal.id).toBe(first.principal.id);
  });

  it.each([
    ["a tampered value", `${GUEST_COOKIE_NAME}=not a token`],
    ["a well-formed token nothing matches", `${GUEST_COOKIE_NAME}=${"z".repeat(43)}`],
    ["no cookie at all", null],
    ["somebody else's cookie name", "session=abcdefghijkl"],
  ])("mints a fresh principal for %s rather than surfacing an error", async (_label, header) => {
    const { ports } = harness();

    const session = await resolveOrMintGuest(header, POLICY, ports);

    expect(session.minted).toBe(true);
    expect(session.principal.id).toBe("guest-1");
  });

  it("treats an expired principal exactly like no identity", async () => {
    let clock = NOW.getTime();
    const { ports, store } = harness({ now: () => clock });

    const first = await resolveOrMintGuest(null, POLICY, ports);
    const header = cookieHeader(first.setCookie);
    const token = readGuestToken(header)!;

    clock += (POLICY.retentionSeconds + 1) * 1000;

    const second = await resolveOrMintGuest(header, POLICY, ports);
    expect(second.minted).toBe(true);
    expect(second.principal.id).not.toBe(first.principal.id);

    // The old principal is unreachable, not deleted on a schedule: the window
    // lapsing is the whole of the cleanup this story commits to.
    await expect(store.findGuest(await sha256TokenHasher.hash(token))).resolves.toBeNull();
  });

  it("never mints on a read path", async () => {
    const { ports } = harness();

    await expect(resolveGuest(null, POLICY, ports)).resolves.toBeNull();
    await expect(
      resolveGuest(`${GUEST_COOKIE_NAME}=${"z".repeat(43)}`, POLICY, ports),
    ).resolves.toBeNull();

    const minted = await resolveOrMintGuest(null, POLICY, ports);
    const resolved = await resolveGuest(cookieHeader(minted.setCookie), POLICY, ports);
    expect(resolved?.principal.id).toBe(minted.principal.id);
    expect(resolved?.minted).toBe(false);
  });

  it("gives two visitors two principals, each with their own token", async () => {
    const { ports } = harness({ tokens: ["token-aaaaaaaaaaa", "token-bbbbbbbbbbb"] });

    const one = await resolveOrMintGuest(null, POLICY, ports);
    const two = await resolveOrMintGuest(null, POLICY, ports);

    expect(one.principal.id).toBe("guest-1");
    expect(two.principal.id).toBe("guest-2");
    expect(readGuestToken(cookieHeader(one.setCookie))).toBe("token-aaaaaaaaaaa");
    expect(readGuestToken(cookieHeader(two.setCookie))).toBe("token-bbbbbbbbbbb");
  });

  it("hashes with SHA-256 and nothing weaker", async () => {
    const hash = await sha256TokenHasher.hash("token-aaaaaaaaaaa");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("token");
  });
});
