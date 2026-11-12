/**
 * Move one of the caller's logs to another chapter of the same mission:
 * `PATCH { chapterId }`. An unknown log and another person's log are both
 * `MISSION_NOT_FOUND` (404).
 */

import { moveLog } from "@zandegi/api";
import { handleJsonRoute } from "@/lib/json-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; logId: string }> },
) {
  return handleJsonRoute(req, { tag: "logs", mutation: true }, async (session, body) => {
    const { id, logId } = await context.params;
    const log = await moveLog(
      { principal: session.principal, missionId: id, logId, request: body },
      { persistence: session.ports.persistence, logs: session.ports.logs },
    );
    return { log };
  });
}
