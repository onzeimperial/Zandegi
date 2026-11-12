/**
 * The caller's logs on one of their missions.
 *
 * `GET` lists them, newest first. `POST { kind: "note", text }` or
 * `POST { kind: "number", value, unit? }` files one under the current chapter.
 * A log uses no model and pays no XP. Another person's mission is
 * `MISSION_NOT_FOUND` (404) either way.
 */

import { listLogs, logProgress, randomIdGenerator, systemClock } from "@zandegi/api";
import { handleJsonRoute } from "@/lib/json-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  return handleJsonRoute(req, { tag: "logs", mutation: false }, async (session) => {
    const { id } = await context.params;
    const logs = await listLogs(
      { principal: session.principal, missionId: id },
      { persistence: session.ports.persistence, logs: session.ports.logs },
    );
    return { logs };
  });
}

export async function POST(req: Request, context: Context) {
  return handleJsonRoute(req, { tag: "logs", mutation: true }, async (session, body) => {
    const { id } = await context.params;
    const log = await logProgress(
      { principal: session.principal, missionId: id, request: body },
      {
        persistence: session.ports.persistence,
        ledger: session.ports.ledger,
        logs: session.ports.logs,
        clock: systemClock,
        ids: randomIdGenerator,
      },
    );
    return { log };
  });
}
