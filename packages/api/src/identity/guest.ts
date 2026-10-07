/**
 * Resolving — or minting — the guest principal.
 *
 * The one rule worth restating: a cookie we cannot resolve mints a fresh
 * principal rather than returning an error. Telling an anonymous visitor that
 * their token failed to resolve leaks that the server recognised and rejected
 * something, and there is no action they could take about it. An expired
 * principal behaves identically, which means an expired guest's missions
 * become unreachable rather than deleted.
 */

import type { Clock, IdGenerator } from "../ports";
import {
  GUEST_COOKIE_NAME,
  readGuestToken,
  serializeGuestCookie,
  type GuestCookiePolicy,
} from "./cookie";
import type {
  GuestPrincipal,
  GuestPrincipalStorePort,
  TokenHasherPort,
  TokenSourcePort,
} from "./ports";

export interface GuestIdentityPorts {
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenSourcePort;
  hasher: TokenHasherPort;
  guests: GuestPrincipalStorePort;
}

export interface GuestSession {
  principal: GuestPrincipal;
  /** True when this request created the principal. */
  minted: boolean;
  /**
   * The `Set-Cookie` value the adapter must write onto the response it
   * constructs, before any body starts. Present on every session, not only a
   * minted one, because re-writing it is how the browser-side expiry renews.
   *
   * Contains the bearer token. Never log it.
   */
  setCookie: string;
}

function session(
  principal: GuestPrincipal,
  token: string,
  minted: boolean,
  policy: GuestCookiePolicy,
  clock: Clock,
): GuestSession {
  return {
    principal,
    minted,
    setCookie: serializeGuestCookie(token, { ...policy, now: clock.now() }),
  };
}

/**
 * Resolve an existing guest, or `null`. Used by reads, which have no business
 * minting an identity: a request for somebody's mission with no cookie is a
 * request for a mission the caller does not own, and the answer is not-found.
 */
export async function resolveGuest(
  cookieHeader: string | null | undefined,
  policy: GuestCookiePolicy,
  ports: GuestIdentityPorts,
): Promise<GuestSession | null> {
  const token = readGuestToken(cookieHeader);
  if (token === null) return null;

  const tokenHash = await ports.hasher.hash(token);
  const principal = await ports.guests.findByTokenHash(tokenHash);
  if (principal === null) return null;

  // Any request from the principal renews the window.
  await ports.guests.renew(tokenHash);
  return session(principal, token, false, policy, ports.clock);
}

/**
 * Resolve the guest, minting one when there is nothing to resolve. Used by
 * mutations, after the origin check and after the body has been validated —
 * so a cross-site or malformed request never creates a principal.
 */
export async function resolveOrMintGuest(
  cookieHeader: string | null | undefined,
  policy: GuestCookiePolicy,
  ports: GuestIdentityPorts,
): Promise<GuestSession> {
  const existing = await resolveGuest(cookieHeader, policy, ports);
  if (existing !== null) return existing;

  const token = ports.tokens.newToken();
  const principal: GuestPrincipal = {
    id: ports.ids.newId(),
    createdAt: ports.clock.now().toISOString(),
  };
  // Only the hash is stored. There is no column, key or log line that holds
  // the token itself anywhere on the server.
  await ports.guests.save(await ports.hasher.hash(token), principal);
  return session(principal, token, true, policy, ports.clock);
}

export { GUEST_COOKIE_NAME };
