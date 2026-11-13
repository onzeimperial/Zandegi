import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it, vi } from "vitest";
import type { GenerationSafetyClass, MissionDraft } from "../client";
import { demoPortsFromStore } from "../demo-store";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { upcastMission } from "../plan/ids";
import {
  fixedClock,
  sequentialIdGenerator,
  type MissionGoalContext,
  type ReminderMessage,
} from "../ports";
import { completeStep } from "../progress/complete-step";
import { appUrlFromEnv, isCronAuthorized } from "./cron";
import { createGmailMailer, gmailCredentialsFromEnv, gmailMailerFromEnv } from "./gmail";
import {
  parseReminderRequest,
  readReminder,
  reminderAddress,
  reminderMessage,
  sendDailyReminders,
  setReminder,
} from "./reminders";

const OWNER: GuestPrincipal = { id: "owner-1", createdAt: "2026-11-01T00:00:00.000Z" };
const EMAIL = "tester@example.com";
const SYDNEY = "Australia/Sydney";
// 09:00 on 12 November in Sydney: the cron's hour.
const MORNING = "2026-11-11T22:00:00.000Z";

const step = (index: number) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 40,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

async function setup(missionTimezone = SYDNEY) {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    // Midnight on the 12th in Sydney: a new mission runs at its base load.
    generatedAt: "2026-11-11T13:00:00.000Z",
    goalText: "learn farsi",
    pursuitSlug: "learn-farsi",
    mission: upcastMission({
      title: "Conversational Farsi",
      goalType: "PROJECT",
      primaryDomain: "Mind",
      chapters: [
        { index: 0, title: "Sounds", exitCondition: "Read", steps: [step(0), step(1), step(2)] },
      ],
    }),
    safetyClass: "NORMAL",
    goalContext: { timezone: missionTimezone, weeklyTimeBudgetMinutes: 600 },
  });
  const sent: ReminderMessage[] = [];
  const mailer = { send: vi.fn(async (message: ReminderMessage) => void sent.push(message)) };
  const sweep = (iso = MORNING, withMailer = true, allowed: readonly string[] = [EMAIL]) =>
    sendDailyReminders(
      { appUrl: "https://zandegi.example/", allowed },
      {
        reminders: demo.reminders,
        persistence: demo.persistence,
        ledger: demo.ledger,
        clock: fixedClock(new Date(iso)),
        mailer: withMailer ? mailer : null,
      },
    );
  const settingsPorts = {
    reminders: demo.reminders,
    clock: fixedClock(new Date(MORNING)),
    mailerConfigured: true,
  };
  const optIn = () =>
    setReminder(
      { principal: OWNER, email: EMAIL, request: { enabled: true, timezone: SYDNEY } },
      settingsPorts,
    );
  const complete = (stepId: string, iso: string) =>
    completeStep(
      { principal: OWNER, missionId: "m-1", stepId, evidence: { kind: "SELF" } },
      {
        persistence: demo.persistence,
        ledger: demo.ledger,
        clock: fixedClock(new Date(iso)),
        ids: sequentialIdGenerator("evt"),
      },
    );
  return { store, demo, sent, mailer, sweep, optIn, settingsPorts, complete };
}

describe("the daily sweep", () => {
  it("sends exactly one neutral reminder linking to Today when steps are left", async () => {
    const { sweep, optIn, sent, store } = await setup();
    await optIn();
    const ledgerBefore = (await store.readLedger(OWNER.id)).length;
    expect(await sweep()).toEqual({
      considered: 1,
      sent: 1,
      nothingDue: 0,
      alreadySent: 0,
      notInvited: 0,
      failed: 0,
      errors: [],
      disabled: false,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(EMAIL);
    expect(sent[0]!.text).toContain("https://zandegi.example/today");
    expect(sent[0]!.text).toContain("2 steps are lined up");
    expect(`${sent[0]!.subject} ${sent[0]!.text}`).not.toMatch(
      /streak|miss|overdue|lose|lost|hurry|last chance|buy|shards/i,
    );
    // Reminders never touch the ledger.
    expect((await store.readLedger(OWNER.id)).length).toBe(ledgerBefore);
  });

  it("never sends twice on the same day, even when triggered again", async () => {
    const { sweep, optIn, sent } = await setup();
    await optIn();
    await sweep();
    const again = await sweep("2026-11-12T05:00:00.000Z"); // 16:00, same Sydney day
    expect(again.alreadySent).toBe(1);
    expect(sent).toHaveLength(1);
    // The next local day gets its own.
    await sweep("2026-11-12T22:00:00.000Z");
    expect(sent).toHaveLength(2);
  });

  it("sends nothing once today's steps are done", async () => {
    const { sweep, optIn, sent, complete } = await setup();
    await optIn();
    await complete("0:0", "2026-11-11T20:00:00.000Z"); // 07:00 on the 12th
    await complete("0:1", "2026-11-11T21:00:00.000Z"); // 08:00 on the 12th
    expect((await sweep()).nothingDue).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it("sends nothing to a person who has not opted in, or who opted out", async () => {
    const { sweep, optIn, sent, settingsPorts } = await setup();
    expect((await sweep()).considered).toBe(0);
    await optIn();
    await setReminder(
      { principal: OWNER, email: EMAIL, request: { enabled: false } },
      settingsPorts,
    );
    expect((await sweep()).considered).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("does nothing at all without a mailer", async () => {
    const { sweep, optIn, demo } = await setup();
    await optIn();
    expect(await sweep(MORNING, false)).toMatchObject({ disabled: true, sent: 0, considered: 0 });
    // The day was not claimed, so configuring email later still sends today.
    expect(await demo.reminders.claimDay(OWNER.id, "2026-11-12")).toBe(true);
  });

  it("counts a failed send with its error class and code, without retrying it the same day", async () => {
    const { sweep, optIn, mailer } = await setup();
    await optIn();
    mailer.send.mockRejectedValueOnce(
      Object.assign(new Error(`535 bad credentials for ${EMAIL}`), { code: "EAUTH" }),
    );
    const failed = await sweep();
    expect(failed).toMatchObject({ failed: 1, errors: ["Error EAUTH"] });
    expect(JSON.stringify(failed)).not.toContain(EMAIL);
    expect((await sweep()).alreadySent).toBe(1);
  });

  it("sends nothing to an address taken off the invite list", async () => {
    const { sweep, optIn, sent } = await setup();
    await optIn();
    expect(await sweep(MORNING, true, ["someone-else@example.com"])).toMatchObject({
      considered: 1,
      notInvited: 1,
      sent: 0,
    });
    expect(sent).toHaveLength(0);
  });

  it("claims the mission's own day when its zone differs from the reminder's", async () => {
    // The reminder was set in Sydney; the mission lives in Los Angeles. At
    // MORNING it is the 12th in Sydney but still the 11th in Los Angeles.
    const { sweep, optIn, sent, demo } = await setup("America/Los_Angeles");
    await optIn();
    expect((await sweep()).sent).toBe(1);
    expect((await demo.reminders.find(OWNER.id))?.lastSentDay).toBe("2026-11-11");
    // 01:00 on the 12th in Los Angeles (20:00 in Sydney, same Sydney day):
    // a new day for the mission, so it gets its own reminder.
    expect((await sweep("2026-11-12T09:00:00.000Z")).sent).toBe(1);
    expect(sent).toHaveLength(2);
  });
});

describe("reminder settings", () => {
  it("turns on with the verified address and off again, forgetting it", async () => {
    const { optIn, demo, settingsPorts } = await setup();
    expect(await readReminder({ principal: OWNER, email: EMAIL }, settingsPorts)).toEqual({
      available: true,
      enabled: false,
    });
    expect(await optIn()).toEqual({ available: true, enabled: true });
    expect((await demo.reminders.find(OWNER.id))?.email).toBe(EMAIL);
    await setReminder(
      { principal: OWNER, email: EMAIL, request: { enabled: false } },
      settingsPorts,
    );
    expect((await demo.reminders.find(OWNER.id))?.email).toBeNull();
  });

  it("is unavailable without a mailer or without a verified address", async () => {
    const { settingsPorts } = await setup();
    expect(
      await readReminder(
        { principal: OWNER, email: EMAIL },
        { ...settingsPorts, mailerConfigured: false },
      ),
    ).toMatchObject({ available: false });
    expect(await readReminder({ principal: OWNER, email: undefined }, settingsPorts)).toMatchObject(
      { available: false },
    );
    await expect(
      setReminder(
        { principal: OWNER, email: undefined, request: { enabled: true } },
        settingsPorts,
      ),
    ).rejects.toBeInstanceOf(GenerationError);
    await expect(
      setReminder(
        { principal: OWNER, email: EMAIL, request: { enabled: true } },
        { ...settingsPorts, mailerConfigured: false },
      ),
    ).rejects.toBeInstanceOf(GenerationError);
  });

  it.each([
    ["no flag", {}],
    ["a text flag", { enabled: "yes" }],
    ["an unknown zone", { enabled: true, timezone: "Mars/Olympus" }],
    ["a smuggled address", { enabled: true, email: "other@example.com" }],
    ["not an object", [true]],
  ])("refuses %s", (_label, body) => {
    expect(() => parseReminderRequest(body)).toThrow(GenerationError);
  });

  it("picks the verified, invited address, never an unverified one", () => {
    const allowed = ["tester@example.com"];
    expect(
      reminderAddress(
        [
          { address: "Tester@Example.com", verified: false },
          { address: " tester@example.com ", verified: true },
        ],
        allowed,
      ),
    ).toBe("tester@example.com");
    expect(reminderAddress([{ address: "tester@example.com", verified: false }], allowed)).toBe(
      undefined,
    );
    expect(reminderAddress([{ address: "other@example.com", verified: true }], allowed)).toBe(
      undefined,
    );
  });

  it("phrases one step in the singular", () => {
    expect(reminderMessage(EMAIL, 1, "https://z.example").text).toContain("1 step is lined up");
  });
});

describe("the trigger guard", () => {
  it("accepts only the exact bearer secret, and refuses everything with no secret", () => {
    const env = { CRON_SECRET: "s3cret" };
    expect(isCronAuthorized("Bearer s3cret", env)).toBe(true);
    expect(isCronAuthorized("Bearer wrong", env)).toBe(false);
    expect(isCronAuthorized("s3cret", env)).toBe(false);
    expect(isCronAuthorized(null, env)).toBe(false);
    expect(isCronAuthorized("Bearer ", {})).toBe(false);
    expect(isCronAuthorized("Bearer ", { CRON_SECRET: "  " })).toBe(false);
  });

  it("builds links from the configured origin, then Vercel's host, then the request", () => {
    expect(appUrlFromEnv({ ZANDEGI_APP_URL: "https://app.example/" }, "http://x")).toBe(
      "https://app.example",
    );
    expect(appUrlFromEnv({ VERCEL_PROJECT_PRODUCTION_URL: "z.vercel.app" }, "http://x")).toBe(
      "https://z.vercel.app",
    );
    expect(appUrlFromEnv({}, "http://localhost:3000")).toBe("http://localhost:3000");
  });
});

describe("the Gmail channel", () => {
  it("is off unless both credentials are set", () => {
    expect(gmailCredentialsFromEnv({})).toBeNull();
    expect(gmailCredentialsFromEnv({ REMINDER_GMAIL_USER: "a@gmail.com" })).toBeNull();
    expect(gmailMailerFromEnv({ REMINDER_GMAIL_APP_PASSWORD: "abcd" })).toBeNull();
    expect(
      gmailCredentialsFromEnv({
        REMINDER_GMAIL_USER: " a@gmail.com ",
        REMINDER_GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
      }),
    ).toEqual({ user: "a@gmail.com", pass: "abcdefghijklmnop" });
  });

  it("sends through the transport, and hides the provider's message on failure", async () => {
    const sendMail = vi.fn(async () => ({}));
    const mailer = createGmailMailer({ user: "z@gmail.com", pass: "p" }, async () => ({
      sendMail,
    }));
    await mailer.send({ to: EMAIL, subject: "s", text: "t" });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Zandegi <z@gmail.com>",
      to: EMAIL,
      subject: "s",
      text: "t",
    });

    const failing = createGmailMailer({ user: "z@gmail.com", pass: "p" }, async () => ({
      sendMail: async () => {
        throw Object.assign(new Error(`550 mailbox ${EMAIL} unavailable`), { code: "EENVELOPE" });
      },
    }));
    const error = await failing.send({ to: EMAIL, subject: "s", text: "t" }).then(
      () => null,
      (caught: unknown) => caught as Error,
    );
    expect(error!.message).toBe("reminder send failed: Error EENVELOPE");
    expect(error!.message).not.toContain(EMAIL);
    expect(error).toMatchObject({ name: "ReminderSendError", code: "EENVELOPE" });
  });
});
