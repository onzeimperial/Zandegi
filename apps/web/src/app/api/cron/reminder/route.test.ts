/**
 * The daily trigger, end to end through the real use case and the in-memory
 * store. Only the mail transport is replaced, so nothing leaves the machine.
 */

import { demoPortsFromEnv, resetDemoPortsCache, type ReminderMessage } from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const outbox = vi.hoisted(() => ({ sent: [] as ReminderMessage[] }));

vi.mock("@zandegi/api", async () => {
  const actual = await vi.importActual<typeof import("@zandegi/api")>("@zandegi/api");
  return {
    ...actual,
    gmailMailerFromEnv: (env: Record<string, string | undefined>) =>
      actual.gmailCredentialsFromEnv(env) === null
        ? null
        : { send: async (message: ReminderMessage) => void outbox.sent.push(message) },
  };
});

const { GET } = await import("./route");

const ORIGIN = "http://localhost";
const SECRET = "cron-secret-for-tests";
const EMAIL = "tester@example.com";

const trigger = (authorization?: string) =>
  GET(
    new Request(`${ORIGIN}/api/cron/reminder`, {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

const step = (index: number) => ({
  id: `0:${index}`,
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 20,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

/** One opted-in person with steps waiting today. */
async function seedOptedIn(): Promise<void> {
  const ports = await demoPortsFromEnv();
  const principal = await ports.accounts.findOrCreate("user_1", {
    id: "owner-1",
    createdAt: new Date().toISOString(),
  });
  await ports.persistence.record({
    missionId: "m-1",
    ownerId: principal.id,
    runId: "run-1",
    generatedAt: new Date().toISOString(),
    goalText: "learn farsi",
    pursuitSlug: "learn-farsi",
    mission: {
      title: "Conversational Farsi",
      goalType: "PROJECT",
      primaryDomain: "Mind",
      chapters: [
        { id: "0", index: 0, title: "Sounds", exitCondition: "Read", steps: [step(0), step(1)] },
      ],
    },
    safetyClass: "NORMAL",
    goalContext: { timezone: "Australia/Sydney" },
  });
  await ports.reminders.enable({
    ownerId: principal.id,
    email: EMAIL,
    timezone: "Australia/Sydney",
    updatedAt: new Date().toISOString(),
  });
}

beforeEach(() => {
  resetDemoPortsCache();
  outbox.sent = [];
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ZANDEGI_MISSION_STORE", "memory");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("ZANDEGI_APP_URL", "https://zandegi.example");
  vi.stubEnv("REMINDER_GMAIL_USER", "zandegi.test@gmail.com");
  vi.stubEnv("REMINDER_GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/cron/reminder", () => {
  it("sends exactly one neutral reminder linking to Today, with the secret", async () => {
    await seedOptedIn();
    const response = await trigger(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ considered: 1, sent: 1, failed: 0 });
    // Counts only: no address in the response.
    expect(body).not.toContain(EMAIL);
    expect(outbox.sent).toHaveLength(1);
    expect(outbox.sent[0]).toMatchObject({ to: EMAIL, subject: "Your steps for today" });
    expect(outbox.sent[0]!.text).toContain("https://zandegi.example/today");

    // A repeated trigger the same day sends nothing new.
    expect(await (await trigger(`Bearer ${SECRET}`)).json()).toMatchObject({
      sent: 0,
      alreadySent: 1,
    });
    expect(outbox.sent).toHaveLength(1);
  });

  it("refuses a call without the secret, or with the wrong one, and sends nothing", async () => {
    await seedOptedIn();
    expect((await trigger()).status).toBe(401);
    expect((await trigger("Bearer wrong")).status).toBe(401);
    expect((await trigger(SECRET)).status).toBe(401);
    expect(outbox.sent).toHaveLength(0);
  });

  it("refuses everything when no secret is configured", async () => {
    await seedOptedIn();
    vi.stubEnv("CRON_SECRET", "");
    expect((await trigger("Bearer ")).status).toBe(401);
    expect((await trigger(`Bearer ${SECRET}`)).status).toBe(401);
    expect(outbox.sent).toHaveLength(0);
  });

  it("sends nothing, and still answers, when email is not configured", async () => {
    await seedOptedIn();
    vi.stubEnv("REMINDER_GMAIL_USER", "");
    const response = await trigger(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ disabled: true, sent: 0 });
    expect(outbox.sent).toHaveLength(0);
  });

  it("keeps the address out of the log", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedOptedIn();
    await trigger(`Bearer ${SECRET}`);
    expect(JSON.stringify(info.mock.calls)).not.toContain(EMAIL);
  });
});
