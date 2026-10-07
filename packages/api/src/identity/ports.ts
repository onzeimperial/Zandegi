/**
 * The guest principal and the ports it needs.
 *
 * Two of these ports exist only so that nothing in this package reaches for
 * ambient crypto. Randomness and hashing arrive injected, exactly as the clock
 * and the id generator do, which is what makes "the server mints the token"
 * a property a test can pin rather than a sentence in a comment.
 */

/**
 * A guest. The only principal that exists in this story: there is no account,
 * no Clerk user and no upgrade path yet.
 *
 * `id` is server-assigned and a client can neither supply nor influence it.
 */
export interface GuestPrincipal {
  readonly id: string;
  /** ISO-8601 UTC, from the clock port. */
  readonly createdAt: string;
}

/** Where the bearer token comes from. Never `Math.random`, never the client. */
export interface TokenSourcePort {
  newToken(): string;
}

/**
 * How a token becomes the thing we store. The token is 256 bits of server
 * randomness, so a single SHA-256 is the right primitive: there is no
 * low-entropy secret to slow an attacker down over, and a slow KDF on the
 * read path would tax every request to no end.
 */
export interface TokenHasherPort {
  hash(token: string): Promise<string>;
}

/**
 * Where guests live. Implemented in `@zandegi/db` — in memory for local
 * development and tests, in Upstash Redis for the deployed demo.
 *
 * Only the hash is ever passed in. This port has no method that could return
 * a token, because there is no token to return.
 */
export interface GuestPrincipalStorePort {
  findByTokenHash(tokenHash: string): Promise<GuestPrincipal | null>;
  save(tokenHash: string, principal: GuestPrincipal): Promise<void>;
  /** Renews the retention window. A no-op when the hash is unknown. */
  renew(tokenHash: string): Promise<void>;
}

/** 32 bytes, base64url-encoded: 43 characters, 256 bits of entropy. */
export const GUEST_TOKEN_BYTES = 32;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const randomTokenSource: TokenSourcePort = {
  newToken: () => base64url(crypto.getRandomValues(new Uint8Array(GUEST_TOKEN_BYTES))),
};

/** Fixes the token sequence for tests. Exhausting it is a test bug, not a path. */
export function fixedTokenSource(...tokens: readonly string[]): TokenSourcePort {
  const queue = [...tokens];
  return {
    newToken: () => {
      const next = queue.shift();
      if (next === undefined) throw new Error("fixedTokenSource exhausted");
      return next;
    },
  };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const sha256TokenHasher: TokenHasherPort = {
  hash: async (token) =>
    toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
};
