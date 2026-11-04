/**
 * Signed-in people. Clerk verifies the session at the web adapter (AD-7); whether
 * that person may use the app, and which principal they are, is decided here.
 *
 * A Clerk user id never becomes a domain id: it maps to an internal principal
 * of the same shape a guest has, so nothing downstream can tell them apart.
 */

import { GenerationError } from "../errors";
import type { Clock, IdGenerator } from "../ports";
import type { Env } from "../demo-store";
import type { GuestPrincipal } from "./ports";

export interface AccountEmail {
  address: string;
  verified: boolean;
}

export interface AccountPrincipalStorePort {
  /** Atomic: requests racing for one account all get the same principal. */
  findOrCreate(clerkUserId: string, candidate: GuestPrincipal): Promise<GuestPrincipal>;
}

function normalizeEmail(address: string): string {
  return address.trim().toLowerCase();
}

export function allowedEmailsFromEnv(env: Env): readonly string[] {
  return (env.ZANDEGI_ALLOWED_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((address) => address.length > 0);
}

/**
 * Whether this person is invited. Only a verified address counts: anyone can
 * type an invited address into a new account, but they cannot verify it.
 */
export function isAccountAllowed(
  emails: readonly AccountEmail[],
  allowed: readonly string[],
): boolean {
  return emails.some((email) => email.verified && allowed.includes(normalizeEmail(email.address)));
}

/**
 * Which identity the app runs on. Clerk keys mean Clerk. No keys means guest
 * mode, but only outside production. Production with no keys or nobody invited
 * is disabled, because anything else would open the model budget to the public.
 */
export type AuthMode = "clerk" | "guest" | "disabled";

export function authModeFromEnv(env: Env): AuthMode {
  const hasKeys =
    (env.CLERK_SECRET_KEY?.trim() ?? "") !== "" &&
    (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "") !== "";
  if (env.NODE_ENV !== "production") return hasKeys ? "clerk" : "guest";
  return hasKeys && allowedEmailsFromEnv(env).length > 0 ? "clerk" : "disabled";
}

export interface ResolveAccountPrincipalInput {
  clerkUserId: string;
  emails: readonly AccountEmail[];
  allowed: readonly string[];
}

export interface ResolveAccountPrincipalPorts {
  accounts: AccountPrincipalStorePort;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * The principal for a signed-in person. The allow decision comes first, so
 * someone who is not invited leaves no row behind.
 */
export async function resolveAccountPrincipal(
  input: ResolveAccountPrincipalInput,
  ports: ResolveAccountPrincipalPorts,
): Promise<GuestPrincipal> {
  if (!isAccountAllowed(input.emails, input.allowed)) {
    throw new GenerationError("ACCOUNT_NOT_ALLOWED", "no verified email on the allowlist");
  }
  return ports.accounts.findOrCreate(input.clerkUserId, {
    id: ports.ids.newId(),
    createdAt: ports.clock.now().toISOString(),
  });
}
