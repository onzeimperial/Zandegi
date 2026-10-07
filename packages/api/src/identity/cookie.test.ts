import { describe, expect, it } from "vitest";
import {
  GUEST_COOKIE_NAME,
  GUEST_TOKEN_PATTERN,
  readGuestToken,
  serializeGuestCookie,
} from "./cookie";
import { randomTokenSource } from "./ports";

const NOW = new Date("2026-10-07T00:00:00.000Z");
const TOKEN = "AbCd1234_-xyzAbCd1234";

function attributes(cookie: string): string[] {
  return cookie.split(";").map((part) => part.trim());
}

describe("the guest cookie", () => {
  it("is HttpOnly, same-site and explicitly expiring", () => {
    const cookie = serializeGuestCookie(TOKEN, {
      retentionSeconds: 30 * 24 * 60 * 60,
      secure: true,
      now: NOW,
    });
    const parts = attributes(cookie);

    expect(parts[0]).toBe(`${GUEST_COOKIE_NAME}=${TOKEN}`);
    expect(parts).toContain("HttpOnly");
    expect(parts).toContain("SameSite=Lax");
    expect(parts).toContain("Path=/");
    expect(parts).toContain("Secure");
    // Both forms of expiry, so it is explicit to every browser rather than
    // implied by whichever one that browser happens to honour.
    expect(parts).toContain("Max-Age=2592000");
    expect(parts).toContain("Expires=Fri, 06 Nov 2026 00:00:00 GMT");
  });

  it("drops Secure only for local development over plain HTTP", () => {
    const cookie = serializeGuestCookie(TOKEN, {
      retentionSeconds: 60,
      secure: false,
      now: NOW,
    });
    expect(attributes(cookie)).not.toContain("Secure");
    expect(attributes(cookie)).toContain("HttpOnly");
  });

  it("refuses to serialise a value that could inject a header", () => {
    for (const malformed of ["", "a b", `x; Domain=evil.test`, "tok\nSet-Cookie: x=y"]) {
      expect(() =>
        serializeGuestCookie(malformed, { retentionSeconds: 60, secure: true, now: NOW }),
      ).toThrow(/malformed guest token/);
    }
  });

  it("round-trips a minted token", () => {
    const token = randomTokenSource.newToken();
    expect(GUEST_TOKEN_PATTERN.test(token)).toBe(true);
    expect(token).toHaveLength(43);

    const cookie = serializeGuestCookie(token, {
      retentionSeconds: 60,
      secure: true,
      now: NOW,
    });
    const header = cookie.split(";", 1)[0]!;
    expect(readGuestToken(`other=1; ${header}; another=2`)).toBe(token);
  });

  it("reads nothing out of a missing, foreign or tampered cookie", () => {
    expect(readGuestToken(null)).toBeNull();
    expect(readGuestToken("")).toBeNull();
    expect(readGuestToken("session=abc")).toBeNull();
    // Too short, illegal characters, and a broken percent-escape: all the same
    // answer, because the caller must not learn which one it was.
    expect(readGuestToken(`${GUEST_COOKIE_NAME}=short`)).toBeNull();
    expect(readGuestToken(`${GUEST_COOKIE_NAME}=has spaces here`)).toBeNull();
    expect(readGuestToken(`${GUEST_COOKIE_NAME}=%E0%A4%A`)).toBeNull();
    expect(readGuestToken(`${GUEST_COOKIE_NAME}=${"x".repeat(129)}`)).toBeNull();
  });
});
