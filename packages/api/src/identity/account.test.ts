import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it, vi } from "vitest";
import { demoPortsFromStore, type StoredDemoStore } from "../demo-store";
import { fixedClock, sequentialIdGenerator } from "../ports";
import {
  allowedEmailsFromEnv,
  authModeFromEnv,
  isAccountAllowed,
  resolveAccountPrincipal,
} from "./account";

const KEYS = { CLERK_SECRET_KEY: "sk_x", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_x" };
const verified = (address: string) => ({ address, verified: true });

describe("the allowlist", () => {
  it("parses a comma-separated list, ignoring case, spaces and blanks", () => {
    expect(allowedEmailsFromEnv({ ZANDEGI_ALLOWED_EMAILS: " A@x.com, ,b@X.com," })).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
    expect(allowedEmailsFromEnv({})).toEqual([]);
  });

  it("matches a verified address, in any case", () => {
    expect(isAccountAllowed([verified("A@X.com")], ["a@x.com"])).toBe(true);
  });

  it("refuses an unverified address even when it is on the list", () => {
    expect(isAccountAllowed([{ address: "a@x.com", verified: false }], ["a@x.com"])).toBe(false);
  });

  it("allows a verified address alongside an unverified one", () => {
    const emails = [{ address: "b@x.com", verified: false }, verified("a@x.com")];
    expect(isAccountAllowed(emails, ["a@x.com"])).toBe(true);
  });

  it("refuses an address that is not listed, and everyone when the list is empty", () => {
    expect(isAccountAllowed([verified("c@x.com")], ["a@x.com"])).toBe(false);
    expect(isAccountAllowed([verified("a@x.com")], [])).toBe(false);
    expect(isAccountAllowed([], ["a@x.com"])).toBe(false);
  });
});

describe("the auth mode", () => {
  const INVITED = { ZANDEGI_ALLOWED_EMAILS: "a@x.com" };

  it("uses Clerk whenever the keys are present outside production", () => {
    expect(authModeFromEnv({ NODE_ENV: "development", ...KEYS })).toBe("clerk");
  });

  it("falls back to guest mode only outside production", () => {
    expect(authModeFromEnv({ NODE_ENV: "development" })).toBe("guest");
    expect(authModeFromEnv({ NODE_ENV: "test" })).toBe("guest");
    expect(authModeFromEnv({})).toBe("guest");
  });

  it("needs both keys", () => {
    expect(authModeFromEnv({ CLERK_SECRET_KEY: "sk_x" })).toBe("guest");
    expect(authModeFromEnv({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_x" })).toBe("guest");
  });

  it("is disabled in production without keys or without anyone invited", () => {
    const production = { NODE_ENV: "production" };
    expect(authModeFromEnv(production)).toBe("disabled");
    expect(authModeFromEnv({ ...production, ...INVITED })).toBe("disabled");
    expect(authModeFromEnv({ ...production, ...KEYS })).toBe("disabled");
    expect(authModeFromEnv({ ...production, ...KEYS, ZANDEGI_ALLOWED_EMAILS: " , " })).toBe(
      "disabled",
    );
    expect(authModeFromEnv({ ...production, ...KEYS, ...INVITED })).toBe("clerk");
  });

  it("ignores the old unauthenticated switch in production", () => {
    expect(
      authModeFromEnv({ NODE_ENV: "production", ENABLE_UNAUTHENTICATED_GENERATION: "true" }),
    ).toBe("disabled");
  });
});

describe("resolving an account's principal", () => {
  function ports() {
    const store = createInMemoryDemoStore() as StoredDemoStore;
    const { accounts } = demoPortsFromStore(store);
    return {
      accounts,
      clock: fixedClock(new Date("2026-11-04T00:00:00.000Z")),
      ids: sequentialIdGenerator("principal"),
    };
  }
  const input = {
    clerkUserId: "user_1",
    emails: [verified("a@x.com")],
    allowed: ["a@x.com"],
  };

  it("gives one person the same principal on every device", async () => {
    const deps = ports();
    const first = await resolveAccountPrincipal(input, deps);
    const second = await resolveAccountPrincipal(input, deps);
    expect(second).toEqual(first);
    expect(first.id).not.toBe("user_1");
  });

  it("gives two concurrent first requests one principal", async () => {
    const deps = ports();
    const [first, second] = await Promise.all([
      resolveAccountPrincipal(input, deps),
      resolveAccountPrincipal(input, deps),
    ]);
    expect(second.id).toBe(first.id);
  });

  it("creates nothing for someone who is not invited", async () => {
    const deps = ports();
    const findOrCreate = vi.spyOn(deps.accounts, "findOrCreate");
    await expect(
      resolveAccountPrincipal({ ...input, emails: [verified("c@x.com")] }, deps),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_ALLOWED" });
    expect(findOrCreate).not.toHaveBeenCalled();
  });
});
