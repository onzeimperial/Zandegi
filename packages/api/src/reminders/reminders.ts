/**
 * The daily reminder: opt-in, at most once a day, never once today's steps are
 * done, and never about loss (law 8).
 *
 * It reads plans through `planToday`, so the reminder and the Today screen
 * agree on what "today's steps" means. It writes no ledger event and changes no
 * XP. The address is personal content: it goes to the mailer and nowhere else,
 * never into a diagnostic, a log line or an incident.
 */

import type { ReminderSettingsView } from "../client";
import { GenerationError } from "../errors";
import type { AccountEmail } from "../identity/account";
import type { GuestPrincipal } from "../identity/ports";
import { planToday, validTimezone } from "../plan/plan-today";
import { storeCall } from "../plan/store-call";
import { safeErrorLabel } from "./gmail";
import type {
  Clock,
  GenerationPersistencePort,
  ReminderMailerPort,
  ReminderMessage,
  ReminderStorePort,
} from "../ports";
import type { ProgressLedgerPort } from "../progress/ledger";

function invalid(diagnostic: string): never {
  throw new GenerationError("INVALID_REQUEST", diagnostic);
}

const normalize = (address: string) => address.trim().toLowerCase();

/**
 * The address a reminder goes to: the person's verified sign-in address that
 * is on the invite list, so it is one they proved they own. `undefined` in
 * guest mode or when no verified address is invited.
 */
export function reminderAddress(
  emails: readonly AccountEmail[],
  allowed: readonly string[],
): string | undefined {
  const found = emails.find(
    (email) => email.verified && allowed.includes(normalize(email.address)),
  );
  return found === undefined ? undefined : normalize(found.address);
}

export interface ReminderSettingsInput {
  principal: GuestPrincipal;
  /** The verified address from the session, if the person has one. */
  email: string | undefined;
}

export interface ReadReminderPorts {
  reminders: ReminderStorePort;
  /** Whether a mailer is configured. Without one, reminders stay off. */
  mailerConfigured: boolean;
}

export async function readReminder(
  input: ReminderSettingsInput,
  ports: ReadReminderPorts,
): Promise<ReminderSettingsView> {
  const record = await storeCall(() => ports.reminders.find(input.principal.id));
  return {
    available: ports.mailerConfigured && input.email !== undefined,
    enabled: record !== null && record.email !== null,
  };
}

/** Strict: `{ enabled: boolean, timezone?: string }` and nothing else. */
export function parseReminderRequest(value: unknown): { enabled: boolean; timezone?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid("body is not an object");
  }
  const body = value as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== "enabled" && key !== "timezone") invalid("reminder has an unknown field");
  }
  if (typeof body.enabled !== "boolean") invalid("enabled is not a boolean");
  if (body.timezone === undefined) return { enabled: body.enabled };
  const timezone = validTimezone(body.timezone);
  if (timezone === undefined) invalid("timezone is not a known zone");
  return { enabled: body.enabled, timezone };
}

export interface SetReminderInput extends ReminderSettingsInput {
  /** Untrusted: the parsed JSON body. */
  request: unknown;
}

export interface SetReminderPorts extends ReadReminderPorts {
  clock: Clock;
}

/** Turn the daily reminder on or off. Turning it off forgets the address. */
export async function setReminder(
  input: SetReminderInput,
  ports: SetReminderPorts,
): Promise<ReminderSettingsView> {
  const request = parseReminderRequest(input.request);
  const ownerId = input.principal.id;
  const updatedAt = ports.clock.now().toISOString();
  if (!request.enabled) {
    await storeCall(() => ports.reminders.disable(ownerId, updatedAt));
    return readReminder(input, ports);
  }
  if (!ports.mailerConfigured) invalid("reminders are not configured");
  const { email } = input;
  if (email === undefined) invalid("no verified address for reminders");
  await storeCall(() =>
    ports.reminders.enable({
      ownerId,
      email,
      ...(request.timezone === undefined ? {} : { timezone: request.timezone }),
      updatedAt,
    }),
  );
  return readReminder(input, ports);
}

/**
 * The reminder's words. Neutral and short: what is waiting, where to go, and
 * how to stop. No streak, no loss, no countdown, no offer (law 8).
 */
export function reminderMessage(to: string, stepsLeft: number, appUrl: string): ReminderMessage {
  const base = appUrl.replace(/\/+$/, "");
  const steps = stepsLeft === 1 ? "1 step is" : `${stepsLeft} steps are`;
  return {
    to,
    subject: "Your steps for today",
    text: [
      `${steps} lined up for you today.`,
      "",
      `Open Today: ${base}/today`,
      "",
      "You get at most one of these a day, and only while steps are waiting.",
      `To stop them, open Today and choose "Stop reminders": ${base}/today#reminder`,
    ].join("\n"),
  };
}

export interface SendDailyRemindersInput {
  /** The app's public origin, for the link in the email. */
  appUrl: string;
  /**
   * The invite list as it is now. A stored address no longer on it gets
   * nothing, so removing someone from the list stops their email too.
   */
  allowed: readonly string[];
}

export interface SendDailyRemindersPorts {
  reminders: ReminderStorePort;
  persistence: GenerationPersistencePort;
  ledger: ProgressLedgerPort;
  clock: Clock;
  /** `null` when email is not configured: nothing is sent. */
  mailer: ReminderMailerPort | null;
}

/** Counts only. No address, no id and no step text ever leave this function in a result. */
export interface SendDailyRemindersResult {
  considered: number;
  sent: number;
  /** Nothing left today: every step on today's list is done, or no mission is open. */
  nothingDue: number;
  /** Today's reminder was already claimed. */
  alreadySent: number;
  /** The stored address is no longer on the invite list. */
  notInvited: number;
  failed: number;
  /** Why sends failed: error class and code only, deduplicated. Never an address. */
  errors: string[];
  /** `true` when no mailer is configured, so nothing was attempted. */
  disabled: boolean;
}

/**
 * Send each opted-in person at most one reminder for their local today, only
 * while today's list has an undone step. One person's failure never stops the
 * others.
 */
export async function sendDailyReminders(
  input: SendDailyRemindersInput,
  ports: SendDailyRemindersPorts,
): Promise<SendDailyRemindersResult> {
  const result: SendDailyRemindersResult = {
    considered: 0,
    sent: 0,
    nothingDue: 0,
    alreadySent: 0,
    notInvited: 0,
    failed: 0,
    errors: [],
    disabled: ports.mailer === null,
  };
  const allowed = new Set(input.allowed.map(normalize));
  const { mailer } = ports;
  if (mailer === null) return result;

  const enabled = await storeCall(() => ports.reminders.listEnabled());
  for (const reminder of enabled) {
    const email = reminder.email;
    if (email === null) continue;
    result.considered += 1;
    if (!allowed.has(normalize(email))) {
      result.notInvited += 1;
      continue;
    }
    try {
      const { plans } = await planToday(
        {
          principal: { id: reminder.ownerId, createdAt: reminder.updatedAt },
          browserTimezone: reminder.timezone,
        },
        { persistence: ports.persistence, ledger: ports.ledger, clock: ports.clock },
      );
      // Each plan's "today" is in its mission's own zone. The claimed day is
      // the first waiting plan's today, and only plans on that same day are
      // counted, so the email's day and the steps it counts always agree.
      const waiting = Object.values(plans)
        .map((plan) => {
          const done = new Set(plan.doneTodayStepIds);
          return { day: plan.today, left: plan.todayStepIds.filter((id) => !done.has(id)).length };
        })
        .filter((plan) => plan.left > 0);
      const day = waiting[0]?.day;
      if (day === undefined) {
        result.nothingDue += 1;
        continue;
      }
      const stepsLeft = waiting
        .filter((plan) => plan.day === day)
        .reduce((sum, plan) => sum + plan.left, 0);
      if (!(await storeCall(() => ports.reminders.claimDay(reminder.ownerId, day)))) {
        result.alreadySent += 1;
        continue;
      }
      // The day is claimed before sending, so a failed send is not retried
      // today: a missing reminder is better than a repeated one (law 8).
      await mailer.send(reminderMessage(email, stepsLeft, input.appUrl));
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      const label = safeErrorLabel(error);
      if (!result.errors.includes(label)) result.errors.push(label);
    }
  }
  return result;
}
