/**
 * Guest identity: the server-created principal, its cookie, and the origin
 * check that guards a mutation. There is no account concept here — a guest is
 * the only principal this story knows about.
 */

export {
  GUEST_COOKIE_NAME,
  GUEST_TOKEN_PATTERN,
  readGuestToken,
  serializeGuestCookie,
  type GuestCookieOptions,
  type GuestCookiePolicy,
} from "./cookie";

export {
  resolveGuest,
  resolveOrMintGuest,
  type GuestIdentityPorts,
  type GuestSession,
} from "./guest";

export {
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  isSameSiteRequest,
  normalizeOrigin,
  trustsForwardedOrigin,
  type SameSiteRequest,
} from "./origin";

export {
  GUEST_TOKEN_BYTES,
  fixedTokenSource,
  randomTokenSource,
  sha256TokenHasher,
  type GuestPrincipal,
  type GuestPrincipalStorePort,
  type TokenHasherPort,
  type TokenSourcePort,
} from "./ports";
