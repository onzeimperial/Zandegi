/**
 * `/api/reminders` with Clerk switched on, through the real session code and the
 * in-memory store. Only Clerk's session is replaced: it needs real keys.
 */

import { resetDemoPortsCache } from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  userId: null as string | null,
  emails: [] as { emailAddress: string; verification: { status: string } | null }[],
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: session.userId }),
  currentUser: async () =>
    session.userId === null ? null : { id: session.userId, emailAddresses: session.emails },
}));

const { GET, POST } = await import("./route");

const ORIGIN = "http://localhost";
const INVITED = "invited@example.com";

function signIn(userId: string, emailAddress = INVITED, status = "verified") {
  session.userId = userId;
  session.emails = [{ emailAddress, verification: { status } }];
}

const get = () => GET(new Request(`${ORIGIN}/api/reminders`));
const post = (body: unknown, origin = ORIGIN) =>
  POST(
    new Request(`${ORIGIN}/api/reminders`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Origin: origin },
    }),
  );

async function expectCode(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: { code } });
}

beforeEach(() => {
  resetDemoPortsCache();
  session.userId = null;
  session.emails = [];
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
  vi.stubEnv("ZANDEGI_ALLOWED_EMAILS", INVITED);
  vi.stubEnv("ZANDEGI_MISSION_STORE", "memory");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("ZANDEGI_ALLOWED_ORIGINS", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("REMINDER_GMAIL_USER", "zandegi.test@gmail.com");
  vi.stubEnv("REMINDER_GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/reminders", () => {
  it("turns the daily reminder on and off for an invited person", async () => {
    signIn("user_1");
    expect(await (await get()).json()).toEqual({ reminder: { available: true, enabled: false } });

    const on = await post({ enabled: true, timezone: "Australia/Sydney" });
    expect(on.status).toBe(200);
    const onText = await on.text();
    expect(JSON.parse(onText)).toEqual({ reminder: { available: true, enabled: true } });
    // The address is used, never echoed.
    expect(onText).not.toContain(INVITED);
    expect(await (await get()).json()).toEqual({ reminder: { available: true, enabled: true } });

    const off = await post({ enabled: false });
    expect(await off.json()).toEqual({ reminder: { available: true, enabled: false } });
  });

  it("refuses a signed-out person with 401 and an uninvited one with 403", async () => {
    await expectCode(await get(), 401, "SIGN_IN_REQUIRED");
    await expectCode(await post({ enabled: true }), 401, "SIGN_IN_REQUIRED");
    signIn("user_2", "stranger@example.com");
    await expectCode(await get(), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await post({ enabled: true }), 403, "ACCOUNT_NOT_ALLOWED");
  });

  it("stays off when email is not configured, and the app keeps answering", async () => {
    vi.stubEnv("REMINDER_GMAIL_APP_PASSWORD", "");
    signIn("user_3");
    expect(await (await get()).json()).toEqual({ reminder: { available: false, enabled: false } });
    await expectCode(await post({ enabled: true }), 400, "INVALID_REQUEST");
  });

  it("refuses a cross-site write and a malformed body", async () => {
    signIn("user_4");
    await expectCode(
      await post({ enabled: true }, "https://evil.example"),
      403,
      "CROSS_SITE_REQUEST",
    );
    await expectCode(await post({ enabled: "yes" }), 400, "INVALID_REQUEST");
    await expectCode(
      await post({ enabled: true, email: "other@example.com" }),
      400,
      "INVALID_REQUEST",
    );
  });

  it("keeps the address out of the server log", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("REMINDER_GMAIL_APP_PASSWORD", "");
    signIn("user_5");
    await post({ enabled: true });
    expect(JSON.stringify(errors.mock.calls)).not.toContain(INVITED);
  });
});
