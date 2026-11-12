/**
 * Who is making this request, for routes and pages.
 *
 * This is the web adapter's half of identity: it verifies the Clerk session and
 * reads the person's addresses. Whether they may come in and which principal
 * they are is decided by `@zandegi/api`. Clerk's server SDK is imported here only
 * when it is the active mode. `layout.tsx`, `account.tsx` and `middleware.ts`
 * import Clerk statically, and use it only in that mode.
 */

import {
  GenerationError,
  allowedEmailsFromEnv,
  authModeFromEnv,
  demoPortsFromEnv,
  guestCookiePolicyFromEnv,
  isAccountAllowed,
  randomIdGenerator,
  randomTokenSource,
  reminderAddress,
  resolveAccountPrincipal,
  resolveGuest,
  resolveOrMintGuest,
  sha256TokenHasher,
  systemClock,
  type AccountEmail,
  type DemoPorts,
  type GenerationErrorCode,
  type GuestPrincipal,
} from "@zandegi/api";

export type AccountAccess =
  | { kind: "guest-mode" }
  | { kind: "disabled" }
  | { kind: "signed-out" }
  | { kind: "not-invited" }
  | { kind: "allowed"; clerkUserId: string; emails: AccountEmail[] };

/** Throws `STORE_UNAVAILABLE` when Clerk cannot answer: unknown is not allowed. */
export async function readAccountAccess(): Promise<AccountAccess> {
  const mode = authModeFromEnv(process.env);
  if (mode === "guest") return { kind: "guest-mode" };
  if (mode === "disabled") return { kind: "disabled" };

  let identity: { clerkUserId: string; emails: AccountEmail[] } | null;
  try {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    const user = userId === null ? null : await currentUser();
    identity =
      userId === null || user === null
        ? null
        : {
            clerkUserId: userId,
            emails: user.emailAddresses.map((email) => ({
              address: email.emailAddress,
              verified: email.verification?.status === "verified",
            })),
          };
  } catch (error) {
    // The class name only: a provider's message can quote keys and URLs.
    const name = error instanceof Error ? error.name : "non-error";
    throw new GenerationError("STORE_UNAVAILABLE", `identity provider failed: ${name}`);
  }

  if (identity === null) return { kind: "signed-out" };
  return isAccountAllowed(identity.emails, allowedEmailsFromEnv(process.env))
    ? { kind: "allowed", ...identity }
    : { kind: "not-invited" };
}

export interface RequestSession {
  principal: GuestPrincipal;
  ports: DemoPorts;
  /**
   * The verified, invited sign-in address, for the daily reminder. Personal
   * content: never logged. Absent in guest mode.
   */
  email?: string;
  /** Guest mode only: re-written so the browser-side expiry renews. */
  setCookie?: string;
}

function guestPorts(ports: DemoPorts) {
  return {
    clock: systemClock,
    ids: randomIdGenerator,
    tokens: randomTokenSource,
    hasher: sha256TokenHasher,
    guests: ports.guests,
  };
}

const REFUSALS: Partial<Record<AccountAccess["kind"], GenerationErrorCode>> = {
  disabled: "GENERATION_DISABLED",
  "signed-out": "SIGN_IN_REQUIRED",
  "not-invited": "ACCOUNT_NOT_ALLOWED",
};

/**
 * The session behind a request. Throws a `GenerationError` when the person may
 * not proceed. `null` happens only in guest mode, on a read from a browser with
 * no guest: it owns nothing, which the caller answers its own way.
 */
export async function resolveRequestSession(
  cookieHeader: string | null,
  options: { mint: boolean },
): Promise<RequestSession | null> {
  const access = await readAccountAccess();
  const refusal = REFUSALS[access.kind];
  if (refusal !== undefined) throw new GenerationError(refusal);

  const ports = await demoPortsFromEnv();

  if (access.kind === "allowed") {
    const allowed = allowedEmailsFromEnv(process.env);
    const principal = await resolveAccountPrincipal(
      { clerkUserId: access.clerkUserId, emails: access.emails, allowed },
      { accounts: ports.accounts, clock: systemClock, ids: randomIdGenerator },
    );
    const email = reminderAddress(access.emails, allowed);
    return { principal, ports, ...(email === undefined ? {} : { email }) };
  }

  const policy = guestCookiePolicyFromEnv(process.env);
  const guest = options.mint
    ? await resolveOrMintGuest(cookieHeader, policy, guestPorts(ports))
    : await resolveGuest(cookieHeader, policy, guestPorts(ports));
  return guest === null ? null : { principal: guest.principal, ports, setCookie: guest.setCookie };
}

/** A person being turned away, as opposed to something going wrong. */
export function isAccessRefusal(code: GenerationErrorCode): boolean {
  return (
    code === "SIGN_IN_REQUIRED" || code === "ACCOUNT_NOT_ALLOWED" || code === "GENERATION_DISABLED"
  );
}

/** The HTTP status for each refusal a session or the daily cap can produce. */
export const ACCESS_STATUS: Partial<Record<GenerationErrorCode, number>> = {
  SIGN_IN_REQUIRED: 401,
  ACCOUNT_NOT_ALLOWED: 403,
  DAILY_LIMIT_REACHED: 429,
  GENERATION_DISABLED: 503,
  STORE_UNAVAILABLE: 503,
};
