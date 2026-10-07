import { describe, expect, it } from "vitest";
import { GenerationError } from "../errors";
import {
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  isSameSiteRequest,
  normalizeOrigin,
  trustsForwardedOrigin,
} from "./origin";

const OWN = "https://zandegi.app/api/generate";

describe("the origin check", () => {
  it("accepts a request from the app's own origin", () => {
    expect(isSameSiteRequest({ origin: "https://zandegi.app", requestUrl: OWN })).toBe(true);
    // Case and a trailing slash are normalisation, not identity.
    expect(isSameSiteRequest({ origin: "HTTPS://Zandegi.app/", requestUrl: OWN })).toBe(true);
  });

  it("rejects a foreign origin, a lookalike and an absent one", () => {
    for (const origin of [
      "https://evil.test",
      "http://zandegi.app",
      "https://zandegi.app.evil.test",
      "https://zandegi.app:8443",
      "null",
      "",
      null,
      undefined,
    ]) {
      expect(isSameSiteRequest({ origin, requestUrl: OWN }), String(origin)).toBe(false);
    }
  });

  it("accepts an origin configuration explicitly allows", () => {
    const allowedOrigins = allowedOriginsFromEnv(
      "https://preview.zandegi.app, http://localhost:3000 , not-a-url",
    );
    expect([...allowedOrigins]).toEqual(["https://preview.zandegi.app", "http://localhost:3000"]);
    expect(
      isSameSiteRequest({ origin: "http://localhost:3000", requestUrl: OWN, allowedOrigins }),
    ).toBe(true);
    expect(
      isSameSiteRequest({ origin: "https://evil.test", requestUrl: OWN, allowedOrigins }),
    ).toBe(false);
  });

  it("reads an absent or malformed allowlist as empty rather than as permissive", () => {
    expect([...allowedOriginsFromEnv(undefined)]).toEqual([]);
    expect([...allowedOriginsFromEnv("")]).toEqual([]);
    expect([...allowedOriginsFromEnv(",,,")]).toEqual([]);
  });

  it("normalises to scheme, host and port only", () => {
    expect(normalizeOrigin("https://zandegi.app/a/b?c=d#e")).toBe("https://zandegi.app");
    expect(normalizeOrigin("  ")).toBeNull();
    expect(normalizeOrigin("zandegi.app")).toBeNull();
  });

  it("throws the stable cross-site code and keeps the attacker's text out of it", () => {
    const error = (() => {
      try {
        assertSameSiteRequest({ origin: "https://evil.test", requestUrl: OWN });
        return null;
      } catch (caught) {
        return caught as GenerationError;
      }
    })();

    expect(error).toBeInstanceOf(GenerationError);
    expect(error!.code).toBe("CROSS_SITE_REQUEST");
    expect(error!.message).toBe("This request did not come from Zandegi.");
    expect(error!.diagnostic).not.toContain("evil.test");
  });
});

describe("behind a proxy", () => {
  // On Vercel the request URL carries the internal host, so comparing it to
  // Origin rejects every real request. These headers describe the public
  // origin -- but only the platform may vouch for them.
  const INTERNAL = "https://zandegi-abc123.vercel.internal/api/generate";

  it("marks the platform's own signal as trustworthy, and nothing else", () => {
    expect(trustsForwardedOrigin("1")).toBe(true);
    expect(trustsForwardedOrigin(undefined)).toBe(false);
    expect(trustsForwardedOrigin("")).toBe(false);
    expect(trustsForwardedOrigin("   ")).toBe(false);
  });

  it("accepts the public origin when the platform vouches for the headers", () => {
    expect(
      isSameSiteRequest({
        origin: "https://zandegi.app",
        requestUrl: INTERNAL,
        forwardedHost: "zandegi.app",
        forwardedProto: "https",
        trustForwarded: true,
      }),
    ).toBe(true);
  });

  it("reads only the client-facing hop of a proxy chain", () => {
    expect(
      isSameSiteRequest({
        origin: "https://zandegi.app",
        requestUrl: INTERNAL,
        forwardedHost: "zandegi.app, internal-1.vercel.internal",
        forwardedProto: "https, http",
        trustForwarded: true,
      }),
    ).toBe(true);
  });

  it("IGNORES forwarded headers a caller spoofs when nothing vouches for them", () => {
    // The attack: send Origin and X-Forwarded-Host naming the same attacker
    // host. Without the platform marker the request URL is the only truth, so
    // this must stay rejected.
    expect(
      isSameSiteRequest({
        origin: "https://evil.example",
        requestUrl: OWN,
        forwardedHost: "evil.example",
        forwardedProto: "https",
      }),
    ).toBe(false);
    expect(
      isSameSiteRequest({
        origin: "https://evil.example",
        requestUrl: OWN,
        forwardedHost: "evil.example",
        forwardedProto: "https",
        trustForwarded: false,
      }),
    ).toBe(false);
  });

  it("still rejects a foreign origin while trusting the proxy", () => {
    expect(
      isSameSiteRequest({
        origin: "https://evil.example",
        requestUrl: INTERNAL,
        forwardedHost: "zandegi.app",
        forwardedProto: "https",
        trustForwarded: true,
      }),
    ).toBe(false);
  });

  it("falls back to the request URL when the forwarded host is missing or unusable", () => {
    for (const forwardedHost of [null, "", "   ", "::not a host::"]) {
      expect(
        isSameSiteRequest({
          origin: "https://zandegi.app",
          requestUrl: OWN,
          forwardedHost,
          trustForwarded: true,
        }),
        String(forwardedHost),
      ).toBe(true);
    }
  });

  it("defaults a missing forwarded protocol to https rather than guessing http", () => {
    expect(
      isSameSiteRequest({
        origin: "https://zandegi.app",
        requestUrl: INTERNAL,
        forwardedHost: "zandegi.app",
        trustForwarded: true,
      }),
    ).toBe(true);
  });
});
