import { describe, expect, it } from "vitest";
import { GenerationError } from "../errors";
import {
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  isSameSiteRequest,
  normalizeOrigin,
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
