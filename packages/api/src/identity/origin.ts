/**
 * The origin check for mutating requests.
 *
 * `SameSite=Lax` already stops the cookie riding along on a cross-site form
 * post, but it is one browser's rule and it is not a server-side decision.
 * This is: a mutation whose `Origin` is not ours is rejected before the body
 * is read and long before any model call, which is the only point at which
 * rejecting it is free.
 */

import { GenerationError } from "../errors";

/** Lowercased scheme + host + port, or `null` for anything unusable. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // `null` is what a browser literally sends for an opaque origin.
  if (trimmed.length === 0 || trimmed === "null") return null;
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return null;
  }
}

export interface SameSiteRequest {
  /** The `Origin` header, verbatim. */
  origin: string | null | undefined;
  /** The request's own URL, so its origin is derived rather than trusted. */
  requestUrl: string;
  /** Extra origins configuration allows, e.g. a preview domain. */
  allowedOrigins?: readonly string[];
}

/** Parse `ZANDEGI_ALLOWED_ORIGINS` — a comma-separated list. */
export function allowedOriginsFromEnv(value: string | undefined): readonly string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => entry !== null);
}

/**
 * An absent `Origin` is rejected along with a foreign one. Every browser sends
 * it on a cross-origin request and on any POST from a modern engine, so the
 * only callers it costs are non-browser clients — which this surface does not
 * serve yet, and which can set the header when it does.
 */
export function isSameSiteRequest(request: SameSiteRequest): boolean {
  const origin = normalizeOrigin(request.origin);
  if (origin === null) return false;

  const own = normalizeOrigin(request.requestUrl);
  if (own !== null && origin === own) return true;

  return (request.allowedOrigins ?? []).includes(origin);
}

/** Throws the stable cross-site code. Carries no detail about the origin seen. */
export function assertSameSiteRequest(request: SameSiteRequest): void {
  if (isSameSiteRequest(request)) return;
  // The diagnostic names the header, not its value: an attacker's origin is
  // attacker-controlled text and does not belong in our logs verbatim.
  throw new GenerationError("CROSS_SITE_REQUEST", "origin header absent or not allowed");
}
