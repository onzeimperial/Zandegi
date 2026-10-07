/**
 * The guest cookie.
 *
 * It is serialised rather than set, because the generate route returns a
 * `ReadableStream` and a response's headers are gone the moment the body
 * starts. There is no post-hoc `cookies()` mutation available on that path, so
 * the adapter writes this string onto the `Response` it constructs.
 */

export const GUEST_COOKIE_NAME = "zandegi_guest";

/**
 * What a token is allowed to look like coming back in. A value that fails this
 * is treated as no identity at all — see `resolveGuest` for why that is not an
 * error.
 *
 * The range is wider than the 43 characters `randomTokenSource` produces so a
 * test may use a readable fixture token, and so a future token length is not a
 * breaking change for cookies already in the wild.
 */
export const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface GuestCookiePolicy {
  /** Seconds of inactivity before the cookie and the principal expire. */
  retentionSeconds: number;
  /** False only for local development over plain HTTP. */
  secure: boolean;
}

export interface GuestCookieOptions extends GuestCookiePolicy {
  /** From the clock port, for the explicit `Expires` attribute. */
  now: Date;
}

/**
 * Build the `Set-Cookie` value.
 *
 * `HttpOnly` keeps the token out of script, `SameSite=Lax` stops a cross-site
 * form post from carrying it, and both `Max-Age` and `Expires` are written so
 * the expiry is explicit to every browser rather than implied by one of them.
 *
 * The returned string contains the bearer token. It is never logged.
 */
export function serializeGuestCookie(token: string, options: GuestCookieOptions): string {
  if (!GUEST_TOKEN_PATTERN.test(token)) {
    // A token we minted always matches. Reaching here is a programming error,
    // and writing an unvalidated value into a header is how header injection
    // happens, so it fails loudly instead.
    throw new Error("refusing to serialise a malformed guest token");
  }

  const maxAge = Math.max(0, Math.floor(options.retentionSeconds));
  const expires = new Date(options.now.getTime() + maxAge * 1000).toUTCString();

  const attributes = [
    `${GUEST_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    `Expires=${expires}`,
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

/**
 * Read the token back out of a `Cookie` header.
 *
 * Returns `null` for anything that is not a well-formed token, including a
 * missing header, a missing cookie and a tampered value. The caller cannot
 * tell those apart, which is the point.
 */
export function readGuestToken(cookieHeader: string | null | undefined): string | null {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== GUEST_COOKIE_NAME) continue;

    const raw = pair.slice(separator + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // A malformed escape is a tampered value: same answer as any other.
      return null;
    }
    return GUEST_TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}
