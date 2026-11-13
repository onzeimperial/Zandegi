/**
 * The browser's IANA zone, carried to server pages in a cookie.
 *
 * A server component cannot ask the browser for its zone, so a small client
 * component writes it here and refreshes once. The server treats the value as
 * untrusted: `planToday` checks it, and uses it only for a mission that has no
 * zone of its own.
 */

export const TIMEZONE_COOKIE = "zandegi_tz";

/** A year: the zone rarely changes, and a stale one is corrected on the next visit. */
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** The cookie that records `zone`. Not secret, so readable by script; `Secure` off localhost. */
export function timezoneCookie(zone: string, secure: boolean): string {
  return [
    `${TIMEZONE_COOKIE}=${encodeURIComponent(zone)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/** The zone recorded in a `Cookie` header, or `undefined`. */
export function timezoneFromCookieHeader(header: string | null | undefined): string | undefined {
  if (header === null || header === undefined) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== TIMEZONE_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
