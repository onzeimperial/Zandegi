/**
 * The daily reminder trigger, called once a day by Vercel Cron (`vercel.json`).
 *
 * It accepts only `Authorization: Bearer $CRON_SECRET`, compared in constant
 * time, and refuses everything else with 401 before touching the store. With no
 * secret configured, every call is refused. It is a GET because that is what
 * Vercel Cron sends; it takes no input, and sending is idempotent per person and
 * local day, so a repeated call sends nothing new.
 *
 * The response and the log carry counts only: never an address, an id or step text.
 */

import {
  appUrlFromEnv,
  demoPortsFromEnv,
  gmailMailerFromEnv,
  isCronAuthorized,
  sendDailyReminders,
  systemClock,
} from "@zandegi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  if (!isCronAuthorized(req.headers.get("authorization"), process.env)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const ports = await demoPortsFromEnv();
    const result = await sendDailyReminders(
      { appUrl: appUrlFromEnv(process.env, new URL(req.url).origin) },
      {
        reminders: ports.reminders,
        persistence: ports.persistence,
        ledger: ports.ledger,
        clock: systemClock,
        mailer: gmailMailerFromEnv(process.env),
      },
    );
    console.info("[cron-reminder]", JSON.stringify(result));
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error(
      "[cron-reminder]",
      JSON.stringify({ outcome: "failed", error: error instanceof Error ? error.name : "unknown" }),
    );
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
