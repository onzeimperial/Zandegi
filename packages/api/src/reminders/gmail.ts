/**
 * The reminder channel: one plain-text email over Gmail SMTP, signed in with an
 * app password.
 *
 * Configuration, read from the environment:
 *   REMINDER_GMAIL_USER          the Gmail address that sends
 *   REMINDER_GMAIL_APP_PASSWORD  its app password (never logged)
 * With either unset there is no mailer, reminders stay off and the app works.
 *
 * nodemailer is imported only when a message is actually sent, so a process
 * with no email configured never loads it.
 */

import type { ReminderMailerPort, ReminderMessage } from "../ports";
import type { Env } from "../demo-store";

export interface GmailCredentials {
  user: string;
  pass: string;
}

export function gmailCredentialsFromEnv(env: Env): GmailCredentials | null {
  const user = env.REMINDER_GMAIL_USER?.trim() ?? "";
  // App passwords are shown with spaces; Gmail accepts them either way.
  const pass = env.REMINDER_GMAIL_APP_PASSWORD?.replace(/\s+/g, "") ?? "";
  return user.length > 0 && pass.length > 0 ? { user, pass } : null;
}

/** The one call this adapter makes on a transport. */
export interface MailTransport {
  sendMail(mail: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

async function gmailTransport(credentials: GmailCredentials): Promise<MailTransport> {
  const { createTransport } = await import("nodemailer");
  return createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: credentials.user, pass: credentials.pass },
  });
}

/** The error's class and code only: an SMTP message can quote the address. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return "non-error";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,24}$/.test(code)
    ? `${error.name} ${code}`
    : error.name;
}

export function createGmailMailer(
  credentials: GmailCredentials,
  transport: (credentials: GmailCredentials) => Promise<MailTransport> = gmailTransport,
): ReminderMailerPort {
  let ready: Promise<MailTransport> | undefined;
  return {
    async send(message: ReminderMessage) {
      try {
        ready ??= transport(credentials);
        await (
          await ready
        ).sendMail({
          from: `Zandegi <${credentials.user}>`,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
      } catch (error) {
        ready = undefined;
        // No cause: it would carry the provider's message past this point.
        throw new Error(`reminder send failed: ${describe(error)}`);
      }
    },
  };
}

/** The configured mailer, or `null` when email is not set up. */
export function gmailMailerFromEnv(env: Env): ReminderMailerPort | null {
  const credentials = gmailCredentialsFromEnv(env);
  return credentials === null ? null : createGmailMailer(credentials);
}
