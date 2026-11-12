/**
 * The caller's daily reminder.
 *
 * `GET` answers `{ reminder: { available, enabled } }`. `POST { enabled, timezone? }`
 * turns it on, using the person's verified sign-in address, or off, which
 * forgets the address. The same guards as the plan and log routes: same-site,
 * a small JSON body, and a session that refuses signed-out (401) and uninvited
 * (403) people. The address never appears in a response or a log line.
 */

import { gmailCredentialsFromEnv, readReminder, setReminder, systemClock } from "@zandegi/api";
import { handleJsonRoute } from "@/lib/json-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mailerConfigured = () => gmailCredentialsFromEnv(process.env) !== null;

export async function GET(req: Request) {
  return handleJsonRoute(req, { tag: "reminders", mutation: false }, async (session) => {
    const reminder = await readReminder(
      { principal: session.principal, email: session.email },
      { reminders: session.ports.reminders, mailerConfigured: mailerConfigured() },
    );
    return { reminder };
  });
}

export async function POST(req: Request) {
  return handleJsonRoute(req, { tag: "reminders", mutation: true }, async (session, body) => {
    const reminder = await setReminder(
      { principal: session.principal, email: session.email, request: body },
      {
        reminders: session.ports.reminders,
        mailerConfigured: mailerConfigured(),
        clock: systemClock,
      },
    );
    return { reminder };
  });
}
